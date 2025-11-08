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
} from '@sqlrooms/room-store';
import {
  createDefaultSqlEditorConfig,
  createSqlEditorSlice,
  SqlEditorSliceConfig,
  SqlEditorSliceState,
} from '@sqlrooms/sql-editor';
import {DatabaseIcon} from 'lucide-react';
import {z} from 'zod';
import {persist} from 'zustand/middleware';
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
    persist(
      (set, get, store) => ({
        ...createRoomShellSlice({
          connector: createWasmMotherDuckDbConnector({
            mdToken,
          }),
          config: {
            layout: {
              type: LayoutTypes.enum.mosaic,
              nodes: {
                first: RoomPanelTypes.enum['data'],
                second: RoomPanelTypes.enum['main'],
                direction: 'row',
                splitPercentage: 30,
              },
            },

            ...createDefaultSqlEditorConfig(),
          },
          room: {
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
      // Persist settings
      {
        // Local storage key
        name: 'md-sql-editor-example-app-state-storage',
        // Subset of the state to persist
        partialize: (state) => ({
          room: BaseRoomConfig.parse(state.room.config),
          layout: LayoutConfig.parse(state.layout.config),
          sqlEditor: SqlEditorSliceConfig.parse(state.sqlEditor.config),
        }),
        merge: (persistedState: any, currentState) => ({
          ...currentState,
          room: {
            ...currentState.room,
            config: BaseRoomConfig.parse(persistedState.room),
          },
          layout: {
            ...currentState.layout,
            config: LayoutConfig.parse(persistedState.layout),
          },
          sqlEditor: {
            ...currentState.sqlEditor,
            config: SqlEditorSliceConfig.parse(persistedState.sqlEditor),
          },
        }),
      },
    ) as StateCreator<RoomState>,
);

export {createRoomStore, useRoomStore};
