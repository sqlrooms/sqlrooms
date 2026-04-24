import {
  BaseRoomConfig,
  createRoomShellSlice,
  createRoomStore,
  LayoutConfig,
  persistSliceConfigs,
  RoomShellSliceState,
} from '@sqlrooms/room-shell';
import {
  createSqlEditorSlice,
  SqlEditorSliceConfig,
  SqlEditorSliceState,
} from '@sqlrooms/sql-editor';
import {DatabaseIcon} from 'lucide-react';
import {z} from 'zod';
import {DataPanel} from './components/DataPanel';
import {MainView} from './components/MainView';

export const RoomPanelTypes = z.enum(['left', 'data', 'main'] as const);
export type RoomPanelTypes = z.infer<typeof RoomPanelTypes>;

/**
 * Room state
 */

export type RoomState = RoomShellSliceState &
  SqlEditorSliceState & {
    // Add your own state here
  };

/**
 * Create a customized room store
 */
export const {roomStore, useRoomStore} = createRoomStore<RoomState>(
  persistSliceConfigs(
    {
      name: 'sql-editor-example-app-state-storage',
      sliceConfigSchemas: {
        room: BaseRoomConfig,
        layout: LayoutConfig,
        sqlEditor: SqlEditorSliceConfig,
      },
    },
    (set, get, store) => ({
      // Base room slice
      ...createRoomShellSlice({
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
                id: RoomPanelTypes.enum['main'],
                panel: RoomPanelTypes.enum['main'],
                defaultSize: '70%',
              },
            ],
          } satisfies LayoutConfig,
          panels: {
            [RoomPanelTypes.enum['main']]: {
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
