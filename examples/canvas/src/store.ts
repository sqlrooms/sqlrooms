import {
  ArtifactsSliceConfig,
  ArtifactsSliceState,
  createArtifactPanelDefinition,
  createArtifactsSlice,
  defineArtifactTypes,
  type ArtifactTypeDefinition,
} from '@sqlrooms/artifacts';
import {
  CanvasSliceConfig,
  CanvasSliceState,
  createCanvasSlice,
} from '@sqlrooms/canvas';
import {
  CellsSliceConfig,
  CellsSliceState,
  createCellsSlice,
  createDefaultCellRegistry,
} from '@sqlrooms/cells';
import {
  BaseRoomConfig,
  createRoomShellSlice,
  createRoomStore,
  LayoutConfig,
  persistSliceConfigs,
  RoomShellSliceState,
} from '@sqlrooms/room-shell';
import {DatabaseIcon, LayoutDashboardIcon} from 'lucide-react';
import {z} from 'zod';
import {DataSourcesPanel} from './components/DataSourcesPanel';
import {CanvasArtifactPanel} from './components/CanvasArtifactPanel';
import {MainView} from './components/MainView';

// App config schema
export const AppConfig = z.object({
  apiKey: z.string().default(''),
});
export type AppConfig = z.infer<typeof AppConfig>;

export type RoomState = RoomShellSliceState &
  ArtifactsSliceState &
  CanvasSliceState &
  CellsSliceState & {
    app: {
      config: AppConfig;
      setApiKey: (apiKey: string) => void;
    };
  };
export const DEFAULT_CANVAS_ARTIFACT_ID = 'canvas';

export const CANVAS_ARTIFACT_TYPES = defineArtifactTypes({
  canvas: {
    label: 'Canvas',
    defaultTitle: 'Canvas',
    icon: LayoutDashboardIcon,
    component: CanvasArtifactPanel,
    onCreate: ({artifactId, store}) => {
      store.getState().canvas.ensureArtifact(artifactId);
    },
    onEnsure: ({artifactId, store}) => {
      store.getState().canvas.ensureArtifact(artifactId);
    },
    onDelete: ({artifactId, store}) => {
      store.getState().canvas.removeArtifact(artifactId);
    },
  },
} satisfies Record<'canvas', ArtifactTypeDefinition<RoomState>>);

export const RoomPanelTypes = z.enum(['main', 'left', 'data'] as const);
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
        artifacts: ArtifactsSliceConfig,
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
            id: 'root',
            type: 'split',
            direction: 'row',
            children: [
              {
                type: 'tabs',
                id: RoomPanelTypes.enum['left'],
                children: [RoomPanelTypes.enum['data']],
                defaultSize: '20%',
                maxSize: '50%',
                minSize: '300px',
                activeTabIndex: 0,
                collapsible: true,
                collapsed: true,
                collapsedSize: 0,
                hideTabStrip: true,
              },
              {
                type: 'tabs',
                id: RoomPanelTypes.enum['main'],
                panel: RoomPanelTypes.enum['main'],
                children: [],
                activeTabIndex: 0,
                defaultSize: '80%',
              },
            ],
          } satisfies LayoutConfig,
          panels: {
            [RoomPanelTypes.enum['main']]: {
              title: 'Canvas',
              icon: () => null,
              component: MainView,
            },
            [RoomPanelTypes.enum['data']]: {
              title: 'Data',
              icon: DatabaseIcon,
              component: DataSourcesPanel,
            },
            artifact: createArtifactPanelDefinition(
              CANVAS_ARTIFACT_TYPES,
              store,
            ),
          },
        },
      })(set, get, store),

      ...createArtifactsSlice<RoomState>({
        artifactTypes: CANVAS_ARTIFACT_TYPES,
        config: {
          artifactsById: {
            [DEFAULT_CANVAS_ARTIFACT_ID]: {
              id: DEFAULT_CANVAS_ARTIFACT_ID,
              type: 'canvas',
              title: 'Canvas',
            },
          },
          artifactOrder: [DEFAULT_CANVAS_ARTIFACT_ID],
          currentArtifactId: DEFAULT_CANVAS_ARTIFACT_ID,
        },
      })(set, get, store),

      ...createCellsSlice({
        cellRegistry: createDefaultCellRegistry(),
      })(set, get, store),

      ...createCanvasSlice()(set, get, store),

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
