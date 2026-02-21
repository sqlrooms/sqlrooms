import {
  Canvas,
  CanvasSliceConfig,
  CanvasSliceState,
  createCanvasSlice,
} from '@sqlrooms/canvas';
import {
  createCellsSlice,
  createDefaultCellRegistry,
  CellsSliceState,
  CellsSliceConfig,
} from '@sqlrooms/cells';
import {
  BaseRoomConfig,
  createRoomShellSlice,
  createRoomStore,
  LayoutConfig,
  LayoutTypes,
  persistSliceConfigs,
  RoomShellSliceState,
} from '@sqlrooms/room-shell';
import {DatabaseIcon} from 'lucide-react';
import {z} from 'zod';
import {DataSourcesPanel} from './DataSourcesPanel';

// App config schema
export const AppConfig = z.object({
  apiKey: z.string().default(''),
});
export type AppConfig = z.infer<typeof AppConfig>;

export type RoomState = RoomShellSliceState &
  CanvasSliceState &
  CellsSliceState & {
    app: {
      config: AppConfig;
      setApiKey: (apiKey: string) => void;
    };
  };
export const RoomPanelTypes = z.enum(['main', 'data'] as const);
export type RoomPanelTypes = z.infer<typeof RoomPanelTypes>;

export const {roomStore, useRoomStore} = createRoomStore<RoomState>(
  persistSliceConfigs(
    {
      name: 'canvas-example-app-state-storage',
      sliceConfigSchemas: {
        room: BaseRoomConfig,
        layout: LayoutConfig,
        canvas: CanvasSliceConfig,
        cells: CellsSliceConfig,
        app: AppConfig,
      },
    },
    (set, get, store) => ({
      ...createRoomShellSlice({
        config: {
          dataSources: [
            {
              tableName: 'earthquakes',
              type: 'url',
              url: 'https://huggingface.co/datasets/sqlrooms/earthquakes/resolve/main/earthquakes.parquet',
            },
          ],
        },
        layout: {
          config: {
            type: LayoutTypes.enum.mosaic,
            nodes: {
              direction: 'row',
              splitPercentage: 20,
              first: 'data',
              second: 'main',
            },
          },
          panels: {
            main: {
              title: 'Canvas',
              icon: () => null,
              component: Canvas,
              placement: 'main',
            },
            data: {
              title: 'Data',
              icon: DatabaseIcon,
              component: DataSourcesPanel,
              placement: 'sidebar',
            },
          },
        },
      })(set, get, store),

      ...createCellsSlice({
        cellRegistry: createDefaultCellRegistry(),
      })(set, get, store),

      ...createCanvasSlice({
        ai: {
          getApiKey: () => get().app.config.apiKey,
          defaultModel: 'gpt-4.1-mini',
        },
      })(set, get, store),

      // App slice with config
      app: {
        config: AppConfig.parse({}),
        setApiKey: (apiKey) =>
          set((state) => ({
            app: {
              ...state.app,
              config: {...state.app.config, apiKey},
            },
          })),
      },
    }),
  ),
);
