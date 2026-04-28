import {createWasmMotherDuckDbConnector} from '@sqlrooms/motherduck';
import {createRoomShellSlice, RoomShellSliceState} from '@sqlrooms/room-shell';
import {
  BaseRoomConfig,
  createRoomStoreCreator,
  LayoutConfig,
  MAIN_VIEW,
  persistSliceConfigs,
} from '@sqlrooms/room-store';
import {
  createSqlEditorSlice,
  SqlEditorSliceConfig,
  SqlEditorSliceState,
} from '@sqlrooms/sql-editor';
import {DatabaseIcon} from 'lucide-react';
import {z} from 'zod';
import {DataPanel} from './components/DataPanel';
import {MainView} from './components/MainView';

export const RoomPanelTypes = z.enum(['left', 'data', MAIN_VIEW] as const);
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
              id: 'root',
              type: 'split',
              direction: 'row',
              children: [
                {
                  type: 'tabs',
                  id: RoomPanelTypes.enum['left'],
                  children: [RoomPanelTypes.enum['data']],
                  defaultSize: '30%',
                  maxSize: '50%',
                  minSize: '300px',
                  activeTabIndex: 0,
                  collapsible: true,
                  collapsed: true,
                  collapsedSize: 0,
                  hideTabStrip: true,
                },
                {
                  type: 'panel',
                  id: MAIN_VIEW,
                  panel: MAIN_VIEW,
                  defaultSize: '70%',
                },
              ],
            } satisfies LayoutConfig,
            panels: {
              [MAIN_VIEW]: {
                component: MainView,
              },
              [RoomPanelTypes.enum['data']]: {
                title: 'Data',
                component: DataPanel,
                icon: DatabaseIcon,
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
