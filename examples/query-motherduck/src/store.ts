import {createWasmMotherDuckDbConnector} from '@sqlrooms/motherduck';
import {
  createRoomShellSlice,
  LayoutTypes,
  RoomShellSliceState,
  StateCreator,
} from '@sqlrooms/room-shell';
import {
  BaseRoomConfig,
  createRoomStoreCreator,
  LayoutConfig,
  persistSliceConfigs,
} from '@sqlrooms/room-store';
import {
  createSqlEditorSlice,
  SqlEditorSliceConfig,
  SqlEditorSliceState,
} from '@sqlrooms/sql-editor';
import {DatabaseIcon} from 'lucide-react';
import {z} from 'zod';
import {DataPanel} from './DataPanel';
import {MainView} from './MainView';

export const RoomPanelTypes = z.enum(['data', 'main'] as const);
export type RoomPanelTypes = z.infer<typeof RoomPanelTypes>;

/**
 * Room state
 */
export type RoomState = RoomShellSliceState & SqlEditorSliceState;

const {createRoomStore, useRoomStore} = createRoomStoreCreator<RoomState>()(
  (mdToken: string) =>
    persistSliceConfigs(
      {
        name: 'md-sql-editor-example-app-state-storage',
        sliceConfigSchemas: {
          room: BaseRoomConfig,
          layout: LayoutConfig,
          sqlEditor: SqlEditorSliceConfig,
        },
      },
      (set, get, store) => ({
        ...createRoomShellSlice({
          connector: createWasmMotherDuckDbConnector({
            mdToken,
          }),
          layout: {
            config: {
              type: LayoutTypes.enum.mosaic,
              nodes: {
                first: RoomPanelTypes.enum['data'],
                second: RoomPanelTypes.enum['main'],
                direction: 'row',
                splitPercentage: 30,
              },
            },
            panels: {
              [RoomPanelTypes.enum['main']]: {
                component: MainView,
                placement: 'main',
              },
              [RoomPanelTypes.enum['data']]: {
                title: 'Data',
                component: DataPanel,
                icon: DatabaseIcon,
                placement: 'sidebar',
              },
            },
          },
        })(set, get, store),

        // Sql editor slice
        ...createSqlEditorSlice()(set, get, store),
      }),
    ),
);

export {createRoomStore, useRoomStore};
