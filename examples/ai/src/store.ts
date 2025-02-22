import {
  AiSliceConfig,
  AiSliceState,
  createAiSlice,
  createDefaultAiConfig,
} from '@sqlrooms/ai';
import {
  createProjectSlice,
  createProjectStore,
  ProjectState,
  StateCreator,
} from '@sqlrooms/project-builder';
import {
  BaseProjectConfig,
  LayoutTypes,
  MAIN_VIEW,
} from '@sqlrooms/project-config';
import {
  createDefaultSqlEditorConfig,
  createSqlEditorSlice,
  SqlEditorSliceConfig,
  SqlEditorSliceState,
} from '@sqlrooms/sql-editor';
import {DatabaseIcon} from 'lucide-react';
import {z} from 'zod';
import {persist} from 'zustand/middleware';
import {DataSourcesPanel} from './components/DataSourcesPanel';
import {MainView} from './components/MainView';

export const ProjectPanelTypes = z.enum([
  'project-details',
  'data-sources',
  'view-configuration',
  MAIN_VIEW,
] as const);
export type ProjectPanelTypes = z.infer<typeof ProjectPanelTypes>;

/**
 * Project config for saving
 */
export const AppConfig =
  BaseProjectConfig.merge(AiSliceConfig).merge(SqlEditorSliceConfig);
export type AppConfig = z.infer<typeof AppConfig>;

/**
 * Project state
 */
type CustomAppState = {
  supportedModels: string[];
  openAiApiKey: string | undefined;
  setOpenAiApiKey: (key: string) => void;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
};
export type AppState = ProjectState<AppConfig> &
  AiSliceState &
  SqlEditorSliceState &
  CustomAppState;

/**
 * Create a customized project store
 */
export const {projectStore, useProjectStore} = createProjectStore<
  AppConfig,
  AppState
>(
  persist(
    (set, get, store) => ({
      // Base project slice
      ...createProjectSlice<AppConfig>({
        project: {
          config: {
            title: 'Demo App Project',
            layout: {
              type: LayoutTypes.enum.mosaic,
              nodes: {
                direction: 'row',
                first: ProjectPanelTypes.enum['data-sources'],
                second: MAIN_VIEW,
                splitPercentage: 30,
              },
            },
            dataSources: [
              {
                tableName: 'earthquakes',
                type: 'url',
                // url: 'https://gist.githubusercontent.com/curran/a08a1080b88344b0c8a7/raw/0e7a9b0a5d22642a06d3d5b9bcbad9890c8ee534/iris.csv',
                url: 'https://raw.githubusercontent.com/keplergl/kepler.gl-data/refs/heads/master/earthquakes/data.csv',
              },
            ],
            ...createDefaultAiConfig(),
            ...createDefaultSqlEditorConfig(),
          },
          panels: {
            [ProjectPanelTypes.enum['data-sources']]: {
              title: 'Data Sources',
              // icon: FolderIcon,
              icon: DatabaseIcon,
              component: DataSourcesPanel,
              placement: 'sidebar',
            },
            main: {
              title: 'Main view',
              icon: () => null,
              component: MainView,
              placement: 'main',
            },
          },
        },
      })(set, get, store),

      // Sql editor slice
      ...createSqlEditorSlice()(set, get, store),

      // Ai slice
      ...createAiSlice({
        getApiKey: () => {
          return get()?.openAiApiKey || '';
        },
      })(set, get, store),

      // Custom app state
      supportedModels: [
        'gpt-4',
        'gpt-4o',
        'gpt-4o-mini',
        'o3-mini',
        'o3-mini-high',
      ],

      openAiApiKey: undefined,
      selectedModel: 'gpt-4o-mini',
      setOpenAiApiKey: (key: string | undefined) => {
        set({openAiApiKey: key});
      },
      setSelectedModel: (model: string) => {
        set({selectedModel: model});
      },
    }),

    // Persist settings
    {
      // Local storage key
      name: 'app-state-storage',
      // Subset of the state to persist
      partialize: (state): Partial<AppState> => ({
        openAiApiKey: state.openAiApiKey,
        selectedModel: state.selectedModel,
      }),
    },
  ) as StateCreator<AppState>,
);
