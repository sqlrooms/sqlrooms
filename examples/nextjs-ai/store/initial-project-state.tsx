import {
  INITIAL_BASE_PROJECT_CONFIG,
  INITIAL_BASE_PROJECT_STATE,
  ProjectStateProps,
} from '@sqlrooms/project-builder';
import {MAIN_VIEW} from '@sqlrooms/project-config';

import {DataSourcesPanel} from '@/components/data-sources-panel';
import {MainView} from '@/components/main-view/main-view';
import {DatabaseIcon, Settings2Icon} from 'lucide-react';
import {DemoProjectConfig, ProjectPanelTypes} from './demo-project-config';

export const INITIAL_PROJECT_STATE: ProjectStateProps<DemoProjectConfig> = {
  ...INITIAL_BASE_PROJECT_STATE,
  initialized: true,
  projectConfig: {
    ...INITIAL_BASE_PROJECT_CONFIG,
    analysisResults: [],
    dataSources: [],
  },
  lastSavedConfig: undefined,
  projectPanels: {
    [ProjectPanelTypes.enum['data-sources']]: {
      title: 'Data Sources',
      // icon: FolderIcon,
      icon: DatabaseIcon,
      component: DataSourcesPanel,
      placement: 'sidebar',
    },
    [ProjectPanelTypes.enum['view-configuration']]: {
      title: 'View Config',
      icon: Settings2Icon,
      component: () => <div>View Config</div>,
      placement: 'sidebar',
    },
    [ProjectPanelTypes.enum[MAIN_VIEW]]: {
      title: 'Main view',
      icon: () => null,
      component: MainView,
      placement: 'main',
    },
  },
};
