import {
  DataSourcesPanel,
  INITIAL_BASE_PROJECT_CONFIG,
  INITIAL_BASE_PROJECT_STATE,
  ProjectDetailsPanel,
  ProjectPanelInfo,
  ProjectStateProps,
} from '@sqlrooms/project-builder';
import {ProjectPanelTypes} from '@sqlrooms/project-config';
import {DemoProjectConfig} from './DemoProjectStore';
import {DatabaseIcon, InfoIcon, Settings2Icon} from 'lucide-react';

export const PROJECT_BUILDER_PANELS: Partial<
  Record<ProjectPanelTypes, ProjectPanelInfo>
> = {
  [ProjectPanelTypes.PROJECT_DETAILS]: {
    title: 'Project Details',
    icon: InfoIcon,
    component: ProjectDetailsPanel,
    placement: 'sidebar',
  },
  [ProjectPanelTypes.DATA_SOURCES]: {
    title: 'Data Sources',
    // icon: FolderIcon,
    icon: DatabaseIcon,
    component: () => <DataSourcesPanel />,
    placement: 'sidebar',
  },
  [ProjectPanelTypes.VIEW_CONFIGURATION]: {
    title: 'View Config',
    icon: Settings2Icon,
    component: () => <div>View Config</div>,
    placement: 'sidebar',
  },
  [ProjectPanelTypes.MAIN_VIEW]: {
    title: 'Main view',
    icon: () => null,
    component: () => <div>Main view</div>,
    placement: 'hidden',
  },
};

export const INITIAL_PROJECT_CONFIG: DemoProjectConfig = {
  ...INITIAL_BASE_PROJECT_CONFIG,
  dataSources: [],
};

export const INITIAL_PROJECT_STATE: ProjectStateProps<DemoProjectConfig> = {
  ...INITIAL_BASE_PROJECT_STATE,
  initialized: true,
  projectConfig: INITIAL_PROJECT_CONFIG,
  lastSavedConfig: undefined,
  projectPanels: PROJECT_BUILDER_PANELS,
};
