import {
  DataSourcesPanel,
  INITIAL_BASE_PROJECT_CONFIG,
  INITIAL_BASE_PROJECT_STATE,
  ProjectDetailsPanel,
  ProjectStateProps,
} from '@sqlrooms/project-builder';
import {ProjectPanelTypes} from '@sqlrooms/project-config';

import {DatabaseIcon, InfoIcon, Settings2Icon} from 'lucide-react';
import {MainView} from '@/components/main-view/main-view';
import {DemoProjectConfig} from './demo-project-config';

export enum DemoPanels {
  PROJECT_DETAILS = 'project-details',
  DATA_SOURCES = 'data-sources',
  VIEW_CONFIGURATION = 'view-configuration',
  MAIN_VIEW = 'main-view',
}

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
    [DemoPanels.PROJECT_DETAILS]: {
      title: 'Project Details',
      icon: InfoIcon,
      component: ProjectDetailsPanel,
      placement: 'sidebar',
    },
    [DemoPanels.DATA_SOURCES]: {
      title: 'Data Sources',
      // icon: FolderIcon,
      icon: DatabaseIcon,
      component: () => <DataSourcesPanel AddDataModal={() => null} />,
      placement: 'sidebar',
    },
    [DemoPanels.VIEW_CONFIGURATION]: {
      title: 'View Config',
      icon: Settings2Icon,
      component: () => <div>View Config</div>,
      placement: 'sidebar',
    },
    [ProjectPanelTypes.MAIN_VIEW]: {
      title: 'Main view',
      icon: () => null,
      component: MainView,
      placement: 'main',
    },
  },
};
