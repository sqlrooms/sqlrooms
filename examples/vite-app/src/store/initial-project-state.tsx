import {
  INITIAL_BASE_PROJECT_CONFIG,
  INITIAL_BASE_PROJECT_STATE,
  ProjectPanelInfo,
  ProjectStateProps,
} from '@sqlrooms/project-builder';
import {MAIN_VIEW} from '@sqlrooms/project-config';
import {DatabaseIcon, InfoIcon, MapIcon, TableIcon} from 'lucide-react';
import AddDataModal from '../components/add-data/AddDataModal';
import ProjectDetailsPanel from '../components/ProjectDetailsPanel';
import {DemoProjectConfig} from './DemoProjectStore';
import {ProjectPanelTypes} from './schemas';
import DataSourcesPanel from '../components/DataSourcesPanel';

export const PROJECT_BUILDER_PANELS: Partial<
  Record<ProjectPanelTypes, ProjectPanelInfo>
> = {
  [ProjectPanelTypes.enum['project-details']]: {
    title: 'Project Details',
    icon: InfoIcon,
    component: () => <ProjectDetailsPanel />,
    placement: 'sidebar',
  },
  [ProjectPanelTypes.enum['data-sources']]: {
    title: 'Data Sources',
    icon: DatabaseIcon,
    component: () => <DataSourcesPanel AddDataModal={AddDataModal} />,
    placement: 'sidebar',
  },
  [ProjectPanelTypes.enum['data-tables']]: {
    title: 'Prepared Data Tables',
    icon: TableIcon,
    component: () => <div>Data Tables</div>,
    placement: 'sidebar-bottom',
  },
  [MAIN_VIEW]: {
    title: 'Main view',
    icon: MapIcon,
    component: () => <div>Main view</div>,
    placement: 'main',
  },
};

export const INITIAL_PROJECT_STATE: ProjectStateProps<DemoProjectConfig> = {
  ...INITIAL_BASE_PROJECT_STATE,
  initialized: true,
  projectConfig: {
    ...INITIAL_BASE_PROJECT_CONFIG,
    dataSources: [],
  },
  lastSavedConfig: undefined,
  projectPanels: PROJECT_BUILDER_PANELS,
};
