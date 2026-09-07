import {createMosaicSlice, type MosaicSliceState} from '@sqlrooms/mosaic';
import {
  createLayoutSlice,
  type LayoutConfig,
  type LayoutSliceState,
} from '@sqlrooms/layout';
import {
  createBaseRoomSlice,
  createRoomStore,
  useBaseRoomStore,
  type BaseRoomStoreState,
} from '@sqlrooms/room-shell';
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
  clear: () => void;
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
    clearBrush: () => void;

    streaming: boolean;
    setStreaming: (streaming: boolean) => void;
    refreshCube: () => void;

    reset: () => void;
    dispose: () => void;
  };
};

export type RoomState = BaseRoomStoreState &
  LayoutSliceState &
  MosaicSliceState &
  ForecastSliceState;

export function useRoomStore<T>(selector: (state: RoomState) => T): T {
  return useBaseRoomStore<RoomState, T>(selector);
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

    const selectionMask = new Uint8Array(CELL_COUNT);
    let selectionSeq = 0;
    let pendingLead: number | null = null;
    let leadRunning = false;
    let playbackTimer: number | null = null;
    let disposed = false;

    const brushSource = {
      reset: () => {
        map?.setBrushCenter(null);
        set((state) =>
          produce(state, (draft) => {
            draft.forecast.brushCenter = null;
          }),
        );
      },
    };

    const publishBrush = (nextCenter: MapBrushCenter | null) => {
      map?.setBrushCenter(nextCenter);
      lab.selection.update({
        source: brushSource,
        value: nextCenter,
        predicate: nextCenter
          ? geoCirclePredicateExpr({
              center: nextCenter,
              radiusKm: get().forecast.brushRadiusKm,
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
      if (disposed) return;
      const seq = ++selectionSeq;
      try {
        const where = predicateSql(lab.selection);
        const table = await lab.df.query({
          type: 'arrow',
          sql: where
            ? `SELECT id FROM cells_current_lead WHERE ${where}`
            : 'SELECT id FROM cells_current_lead',
        });
        if (disposed || seq !== selectionSeq) return;
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

        const rows = await lab.df.query({
          type: 'json',
          sql: `SELECT avg(value) AS mean_temp,
  sum(area_km2) AS selected_area,
  sum(CASE WHEN value >= ${HOT_THRESHOLD_C} THEN area_km2 ELSE 0 END) AS hot_area
FROM cells_current_lead${where ? ` WHERE ${where}` : ''}`,
        });
        if (disposed || seq !== selectionSeq) return;
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

    const fetchForecastTime = async (leadIndex: number) => {
      if (disposed) return;
      const rows = await lab.df.query({
        type: 'json',
        sql: `SELECT valid_time_ms FROM forecast_times WHERE time_index = ${leadIndex}`,
      });
      const ms = rows[0]?.valid_time_ms;
      if (disposed) return;
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
          await fetchForecastTime(lead);
          await refreshSelection();
        }
      } catch (error) {
        console.error('DataFusion lead swap failed', error);
      } finally {
        leadRunning = false;
        if (pendingLead !== null) void runLeadLoop();
      }
    };

    const requestLead = (index: number) => {
      if (disposed) return;
      const leadIndex = Math.max(0, Math.min(index, lab.cube.leadCount - 1));
      map?.setLeadIndex(leadIndex);
      pendingLead = leadIndex;
      set((state) =>
        produce(state, (draft) => {
          draft.forecast.leadIndex = leadIndex;
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
        requestLead((get().forecast.leadIndex + 1) % lab.cube.leadCount);
      }, PLAYBACK_STEP_MS);
    };

    const onSelectionValue = () => void refreshSelection();
    lab.selection.addEventListener('value', onSelectionValue);
    void fetchForecastTime(0);
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
            const forecast = get().forecast;
            nextMap.setLeadIndex(forecast.leadIndex);
            nextMap.setBrushEnabled(forecast.brushEnabled);
            nextMap.setBrushRadiusKm(forecast.brushRadiusKm);
            nextMap.setBrushCenter(forecast.brushCenter);
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
          const next = !get().forecast.brushEnabled;
          map?.setBrushEnabled(next);
          map?.setBrushRadiusKm(get().forecast.brushRadiusKm);
          if (!next) publishBrush(null);
          set((state) =>
            produce(state, (draft) => {
              draft.forecast.brushEnabled = next;
              draft.forecast.brushCenter = null;
            }),
          );
        },
        setBrushRadiusKm: (radiusKm) => {
          set((state) =>
            produce(state, (draft) => {
              draft.forecast.brushRadiusKm = radiusKm;
            }),
          );
          map?.setBrushRadiusKm(radiusKm);
          const center = get().forecast.brushCenter;
          if (center) publishBrush(center);
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
            if (get().forecast.brushCenter) publishBrush(null);
            return;
          }
          publishBrush(next);
        },
        clearBrush: () => {
          if (get().forecast.brushCenter) publishBrush(null);
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
          disposed = true;
          selectionSeq += 1;
          pendingLead = null;
          stopPlayback();
          lab.selection.removeEventListener('value', onSelectionValue);
          map = null;
        },
      },
    };
  };
}

/**
 * The DataFusion-WASM Coordinator has to exist before the Mosaic slice is
 * created, so the room store cannot be a static module export like other
 * examples' stores. It is built once the ECMWF cube has streamed in and the
 * Coordinator is ready; see App.tsx. The room is deliberately hand-composed
 * without a DuckDB slice because DataFusion handles every query.
 */
export function createForecastRoomStore(lab: Lab) {
  const {roomStore, useRoomStore: useRoomStoreHook} =
    createRoomStore<RoomState>((set, get, store) => ({
      ...createBaseRoomSlice()(set, get, store),

      ...createLayoutSlice({
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
