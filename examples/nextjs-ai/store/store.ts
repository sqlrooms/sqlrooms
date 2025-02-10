import {DataSourcesPanel} from '@/components/data-sources-panel';
import {MainView} from '@/components/main-view';
import {createOpenAI} from '@ai-sdk/openai';
import {
  AiSliceState,
  AiSliceConfig,
  createAiSlice,
  createDefaultAiConfig,
} from '@sqlrooms/ai';
import {createProjectStore, ProjectState} from '@sqlrooms/project-builder';
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
export type AppState = ProjectState<AppConfig> &
  AiSliceState &
  SqlEditorSliceState;

/**
 * Create a customized project store
 */
export const {projectStore, useProjectStore} = createProjectStore<
  AppConfig,
  AppState
>(
  {
    initialized: true,
    projectConfig: {
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
    projectPanels: {
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

  createSqlEditorSlice(),
  createAiSlice({
    supportedModels: [
      'gpt-4',
      'gpt-4o',
      'gpt-4o-mini',
      'o3-mini',
      'o3-mini-high',
    ],
    createModel: (model: string, apiKey: string) => {
      const openai = createOpenAI({apiKey});
      return openai(model, {
        structuredOutputs: true,
      });
    },
  }),
);
