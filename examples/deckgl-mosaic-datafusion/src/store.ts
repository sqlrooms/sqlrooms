import {createMosaicSlice} from '@sqlrooms/mosaic';
import {MosaicSliceState} from '@sqlrooms/mosaic/dist/MosaicSlice';
import {
  createRoomShellSlice,
  createRoomStore,
  LayoutConfig,
  RoomShellSliceState,
  useBaseRoomShellStore,
} from '@sqlrooms/room-shell';
import type {Table} from '@uwdata/flechette';
import type {ExprNode} from '@uwdata/mosaic-sql';
import type {Selection} from '@uwdata/mosaic-core';
import {produce} from 'immer';
import {MapIcon, SlidersHorizontalIcon} from 'lucide-react';
import {z} from 'zod';
import {ForecastPanel} from './components/ForecastPanel';
import {MainView} from './components/MainView';
import type {Lab} from './hooks/use-forecast-lab';
import {geoCirclePredicateExpr} from './lab/geo-filter';
import type {MapBrushCenter, MapView} from './lab/map-view';
import {BOUNDS, CELL_COUNT} from './lab/types';

export const RoomPanelTypes = z.enum(['forecast', 'main'] as const);
export type RoomPanelTypes = z.infer<typeof RoomPanelTypes>;

export const HOT_THRESHOLD_C = 25;
const PLAYBACK_STEP_MS = 450;

export type ForecastSession = {
  leadIndex: number;
  forecastTimeMs: number | null;
  selectedCount: number;
  meanTemp: number | null;
  selectedAreaKm2: number | null;
  hotAreaKm2: number | null;
  playing: boolean;
  requestLead: (index: number) => void;
  togglePlay: () => void;
  reset: () => void;
};

export type HoverBrush = {
  enabled: boolean;
  radiusKm: number;
  active: boolean;
  toggle: () => void;
  setRadiusKm: (radiusKm: number) => void;
  onPointerMove: (clientX: number, clientY: number) => void;
};

export type ForecastSliceState = {
  forecast: {
    lab: Lab;

    map: MapView | null;
    setMap: (map: MapView | null) => void;

    leadIndex: number;
    forecastTimeMs: number | null;
    selectedCount: number;
    meanTemp: number | null;
    selectedAreaKm2: number | null;
    hotAreaKm2: number | null;
    playing: boolean;
    requestLead: (index: number) => void;
    togglePlay: () => void;

    brushEnabled: boolean;
    brushRadiusKm: number;
    brushCenter: MapBrushCenter | null;
    toggleBrush: () => void;
    setBrushRadiusKm: (radiusKm: number) => void;
    onBrushPointerMove: (clientX: number, clientY: number) => void;

    streaming: boolean;
    setStreaming: (streaming: boolean) => void;
    refreshCube: () => void;

    reset: () => void;
    dispose: () => void;
  };
};

export type RoomState = RoomShellSliceState &
  MosaicSliceState &
  ForecastSliceState;

export function useRoomStore<T>(selector: (state: RoomState) => T): T {
  return useBaseRoomShellStore<RoomState, T>(selector);
}

function predicateSql(selection: Selection) {
  const predicate = selection.predicate(undefined, true) as
    | string
    | ExprNode
    | Array<string | ExprNode>
    | undefined;
  if (!predicate || (Array.isArray(predicate) && predicate.length === 0))
    return '';
  if (Array.isArray(predicate))
    return predicate
      .map(String)
      .filter(Boolean)
      .map((fragment) => `(${fragment})`)
      .join(' AND ');
  return String(predicate);
}

/**
 * Drives the forecast lead, hover-brush, and crossfilter selection loop.
 * ForecastPanel and MainView both need this state and its actions, so it
 * lives in the room store rather than component-local hook state. The SQL
 * engine is the source of truth: any Mosaic predicate (chart brushes,
 * category toggles, the map geo circle) becomes one id query whose Arrow
 * result fills a reused mask buffer, avoiding per-cell JS objects on the
 * hot path.
 */
function createForecastSlice(lab: Lab) {
  return (
    set: (fn: (state: RoomState) => RoomState) => void,
    get: () => RoomState,
  ): ForecastSliceState => {
    let map: MapView | null = null;
    let leadIndex = 0;
    let brushEnabled = false;
    let brushRadiusKm = 175;
    let brushCenter: MapBrushCenter | null = null;

    const selectionMask = new Uint8Array(CELL_COUNT);
    let selectionSeq = 0;
    let pendingLead: number | null = null;
    let leadRunning = false;
    let playbackTimer: number | null = null;

    const brushSource = {
      reset: () => {
        brushCenter = null;
        map?.setBrushCenter(null);
        set((state) =>
          produce(state, (draft) => {
            draft.forecast.brushCenter = null;
          }),
        );
      },
    };

    const publishBrush = (nextCenter: MapBrushCenter | null) => {
      brushCenter = nextCenter;
      map?.setBrushCenter(nextCenter);
      lab.selection.update({
        source: brushSource,
        value: nextCenter,
        predicate: nextCenter
          ? geoCirclePredicateExpr({
              center: nextCenter,
              radiusKm: brushRadiusKm,
            })
          : null,
      });
      set((state) =>
        produce(state, (draft) => {
          draft.forecast.brushCenter = nextCenter;
        }),
      );
    };

    const refreshSelection = async () => {
      const seq = ++selectionSeq;
      try {
        const where = predicateSql(lab.selection);
        const table = (await lab.df.query({
          type: 'arrow',
          sql: where
            ? `SELECT id FROM cells_current_lead WHERE ${where}`
            : 'SELECT id FROM cells_current_lead',
        })) as Table;
        if (seq !== selectionSeq) return;
        selectionMask.fill(0);
        let count = 0;
        const ids = table.getChild('id')?.toArray() as
          | ArrayLike<number>
          | undefined;
        for (let i = 0, n = ids?.length ?? 0; i < n; i += 1) {
          const id = Number(ids![i]);
          if (id >= 0 && id < CELL_COUNT && !selectionMask[id]) {
            selectionMask[id] = 1;
            count += 1;
          }
        }
        map?.setMask(selectionMask);

        const rows = (await lab.df.query({
          type: 'json',
          sql: `SELECT avg(value) AS mean_temp,
  sum(area_km2) AS selected_area,
  sum(CASE WHEN value >= ${HOT_THRESHOLD_C} THEN area_km2 ELSE 0 END) AS hot_area
FROM cells_current_lead${where ? ` WHERE ${where}` : ''}`,
        })) as Array<{
          mean_temp: number | null;
          selected_area: number | null;
          hot_area: number | null;
        }>;
        if (seq !== selectionSeq) return;
        const mean = rows[0]?.mean_temp;
        const selectedArea = rows[0]?.selected_area;
        const hotArea = rows[0]?.hot_area;
        set((state) =>
          produce(state, (draft) => {
            draft.forecast.selectedCount = count;
            draft.forecast.meanTemp = mean == null ? null : Number(mean);
            draft.forecast.selectedAreaKm2 =
              selectedArea == null ? null : Number(selectedArea);
            draft.forecast.hotAreaKm2 =
              hotArea == null ? null : Number(hotArea);
          }),
        );
      } catch (error) {
        console.error('DataFusion selection refresh failed', error);
      }
    };

    const fetchForecastTime = async () => {
      const rows = (await lab.df.query({
        type: 'json',
        sql: `SELECT valid_time_ms FROM forecast_times WHERE time_index = ${leadIndex}`,
      })) as Array<{valid_time_ms: number | null}>;
      const ms = rows[0]?.valid_time_ms;
      set((state) =>
        produce(state, (draft) => {
          draft.forecast.forecastTimeMs = ms == null ? null : Number(ms);
        }),
      );
    };

    const runLeadLoop = async () => {
      leadRunning = true;
      try {
        while (pendingLead !== null) {
          const lead = pendingLead;
          pendingLead = null;
          await lab.df.setLead(lead);
          if (pendingLead !== null) continue;
          lab.coordinator.clients.forEach((client) => {
            if (client.enabled) void client.requestQuery();
          });
          await fetchForecastTime();
          await refreshSelection();
        }
      } catch (error) {
        console.error('DataFusion lead swap failed', error);
      } finally {
        leadRunning = false;
      }
    };

    const requestLead = (index: number) => {
      leadIndex = index;
      map?.setLeadIndex(index);
      pendingLead = index;
      set((state) =>
        produce(state, (draft) => {
          draft.forecast.leadIndex = index;
        }),
      );
      if (!leadRunning) void runLeadLoop();
    };

    const stopPlayback = () => {
      if (playbackTimer !== null) {
        window.clearInterval(playbackTimer);
        playbackTimer = null;
      }
    };

    const startPlayback = () => {
      stopPlayback();
      playbackTimer = window.setInterval(() => {
        requestLead((leadIndex + 1) % lab.cube.leadCount);
      }, PLAYBACK_STEP_MS);
    };

    const onSelectionValue = () => void refreshSelection();
    lab.selection.addEventListener('value', onSelectionValue);
    void fetchForecastTime();
    void refreshSelection();

    return {
      forecast: {
        lab,

        map: null,
        setMap: (nextMap) => {
          map = nextMap;
          set((state) =>
            produce(state, (draft) => {
              draft.forecast.map = nextMap;
            }),
          );
          if (nextMap) {
            nextMap.setLeadIndex(leadIndex);
            void refreshSelection();
          }
        },

        leadIndex: 0,
        forecastTimeMs: null,
        selectedCount: 0,
        meanTemp: null,
        selectedAreaKm2: null,
        hotAreaKm2: null,
        playing: false,
        requestLead,
        togglePlay: () => {
          const next = !get().forecast.playing;
          if (next) startPlayback();
          else stopPlayback();
          set((state) =>
            produce(state, (draft) => {
              draft.forecast.playing = next;
            }),
          );
        },

        brushEnabled: false,
        brushRadiusKm: 175,
        brushCenter: null,
        toggleBrush: () => {
          const next = !brushEnabled;
          brushEnabled = next;
          brushCenter = null;
          map?.setBrushEnabled(next);
          map?.setBrushRadiusKm(brushRadiusKm);
          if (!next) publishBrush(null);
          set((state) =>
            produce(state, (draft) => {
              draft.forecast.brushEnabled = next;
              draft.forecast.brushCenter = null;
            }),
          );
        },
        setBrushRadiusKm: (radiusKm) => {
          brushRadiusKm = radiusKm;
          map?.setBrushRadiusKm(radiusKm);
          if (brushCenter) publishBrush(brushCenter);
          set((state) =>
            produce(state, (draft) => {
              draft.forecast.brushRadiusKm = radiusKm;
            }),
          );
        },
        onBrushPointerMove: (clientX, clientY) => {
          const next = map?.screenToLngLat(clientX, clientY);
          if (
            !next ||
            next.lon < BOUNDS.west ||
            next.lon > BOUNDS.east ||
            next.lat < BOUNDS.south ||
            next.lat > BOUNDS.north
          ) {
            return;
          }
          publishBrush(next);
        },

        streaming: false,
        setStreaming: (streaming) => {
          if (get().forecast.streaming === streaming) return;
          set((state) =>
            produce(state, (draft) => {
              draft.forecast.streaming = streaming;
            }),
          );
        },
        refreshCube: () => {
          map?.refreshCube();
          void refreshSelection();
        },

        reset: () => {
          stopPlayback();
          lab.selection.reset();
          set((state) =>
            produce(state, (draft) => {
              draft.forecast.playing = false;
            }),
          );
          requestLead(0);
        },

        dispose: () => {
          stopPlayback();
          lab.selection.removeEventListener('value', onSelectionValue);
        },
      },
    };
  };
}

/**
 * The DataFusion-WASM Coordinator has to exist before the mosaic slice is
 * created (createMosaicSlice only builds a DuckDB-backed coordinator when
 * none is supplied), so the room store cannot be a static module export
 * here the way other examples' stores are. Instead it is built once the
 * ECMWF cube has streamed in and the Coordinator is ready; see App.tsx.
 */
export function createForecastRoomStore(lab: Lab) {
  const {roomStore, useRoomStore: useRoomStoreHook} =
    createRoomStore<RoomState>((set, get, store) => ({
      ...createRoomShellSlice({
        config: {
          title: 'ECMWF IFS ENS forecast explorer',
          dataSources: [],
        },
        layout: {
          config: {
            type: 'split',
            id: 'root',
            direction: 'row',
            children: [
              {
                type: 'tabs',
                id: RoomPanelTypes.enum.forecast,
                children: [RoomPanelTypes.enum.forecast],
                defaultSize: '30%',
                minSize: '320px',
                maxSize: '50%',
                activeTabIndex: 0,
                collapsible: true,
                collapsedSize: 0,
                hideTabStrip: true,
              },
              {
                type: 'panel',
                id: RoomPanelTypes.enum.main,
                panel: RoomPanelTypes.enum.main,
                defaultSize: '70%',
              },
            ],
          } satisfies LayoutConfig,
          panels: {
            [RoomPanelTypes.enum.forecast]: {
              title: 'Forecast',
              icon: SlidersHorizontalIcon,
              component: ForecastPanel,
            },
            [RoomPanelTypes.enum.main]: {
              title: 'Map',
              icon: MapIcon,
              component: MainView,
            },
          },
        },
      })(set, get, store),

      ...createMosaicSlice({coordinator: lab.coordinator})(set, get, store),

      ...createForecastSlice(lab)(set, get),
    }));

  // lab.selection already drives the forecast slice's crossfilter clients
  // (built above) and MosaicCharts's vgplot clients, so it is registered
  // under the store's usual 'brush' selection name rather than recreated
  // with getSelection().
  roomStore.setState((state) =>
    produce(state, (draft) => {
      draft.mosaic.selections.brush = lab.selection;
    }),
  );

  return {roomStore, useRoomStore: useRoomStoreHook};
}
