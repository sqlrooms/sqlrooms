import {DataSourcesPanel} from '@/components/data-sources-panel';
import {MainView} from '@/components/main-view';
import {createOpenAI} from '@ai-sdk/openai';
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
type PersistedCustomAppState = {
  openAiApiKey: string | undefined;
  setOpenAiApiKey: (key: string) => void;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
};
type CustomAppState = {
  supportedModels: string[];
} & PersistedCustomAppState;
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
>((set, get, store) => ({
  // Base project slice
  ...createProjectSlice<AppConfig>({
    project: {
      initialized: true,
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
        dataSources: [],
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
    createModel: (model: string) => {
      if (!get().openAiApiKey) {
        throw new Error('OpenAI API key is required');
      }
      const openai = createOpenAI({
        apiKey: get().openAiApiKey,
      });
      return openai(model, {
        structuredOutputs: true,
      });
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
  // Persisted custom app state (local storage is used by default)
  ...persist<PersistedCustomAppState, any, any>(
    (set) => ({
      openAiApiKey: undefined,
      selectedModel: 'gpt-4o-mini',
      setOpenAiApiKey: (key: string | undefined) => {
        set({openAiApiKey: key});
      },
      setSelectedModel: (model: string) => {
        set({selectedModel: model});
      },
    }),
    {name: 'app-state-storage'},
  )(set, get, store),
}));
