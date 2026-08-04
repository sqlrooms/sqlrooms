import {createMosaicSlice} from '@sqlrooms/mosaic';
import {MosaicSliceState} from '@sqlrooms/mosaic/dist/MosaicSlice';
import {
  createRoomShellSlice,
  createRoomStore,
  LayoutConfig,
  RoomShellSliceState,
} from '@sqlrooms/room-shell';
import {produce} from 'immer';
import {MapIcon, SlidersHorizontalIcon} from 'lucide-react';
import {z} from 'zod';
import {ForecastPanel} from './components/ForecastPanel';
import {MainView} from './components/MainView';
import type {Lab} from './hooks/use-forecast-lab';

export const RoomPanelTypes = z.enum(['forecast', 'main'] as const);
export type RoomPanelTypes = z.infer<typeof RoomPanelTypes>;

export type RoomState = RoomShellSliceState & MosaicSliceState;

/**
 * The DataFusion-WASM Coordinator has to exist before the mosaic slice is
 * created (createMosaicSlice only builds a DuckDB-backed coordinator when
 * none is supplied), so the room store cannot be a static module export
 * here the way other examples' stores are. Instead it is built once the
 * ECMWF cube has streamed in and the Coordinator is ready; see App.tsx.
 */
export function createForecastRoomStore(lab: Lab) {
  const {roomStore, useRoomStore} = createRoomStore<RoomState>(
    (set, get, store) => ({
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
    }),
  );

  // The room's Selection is shared with the crossfilter clients created by
  // the source app's hooks (useForecastSession, useHoverBrush, MosaicCharts)
  // before the room store existed, so it is registered under the store's
  // usual 'brush' selection name rather than recreated with getSelection().
  roomStore.setState((state) =>
    produce(state, (draft) => {
      draft.mosaic.selections.brush = lab.selection;
    }),
  );

  return {roomStore, useRoomStore};
}
