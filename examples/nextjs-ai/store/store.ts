import {DataSourcesPanel} from '@/components/data-sources-panel';
import {MainView} from '@/components/main-view/main-view';
import {createProjectStore} from '@sqlrooms/project-builder';
import {
  BaseProjectConfig,
  LayoutTypes,
  MAIN_VIEW,
} from '@sqlrooms/project-config';
import {
  createDefaultSqlEditorConfig,
  createSqlEditorSlice,
  SqlEditorSliceConfig,
} from '@sqlrooms/sql-editor';
import {DatabaseIcon} from 'lucide-react';
import {z} from 'zod';
import {
  AiSliceConfig,
  createAiSlice,
  createDefaultAiConfig,
} from './ai/ai-slice';

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
export const DemoProjectConfig =
  BaseProjectConfig.merge(AiSliceConfig).merge(SqlEditorSliceConfig);
export type DemoProjectConfig = z.infer<typeof DemoProjectConfig>;

/**
 * Create a customized project store
 */
export const {projectStore, useProjectStore} =
  createProjectStore<DemoProjectConfig>(
    {
      initialized: true,
      projectConfig: {
        title: 'Demo Project',
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
        [ProjectPanelTypes.enum[MAIN_VIEW]]: {
          title: 'Main view',
          icon: () => null,
          component: MainView,
          placement: 'main',
        },
      },
    },

    createSqlEditorSlice(),
    createAiSlice(),
  );
