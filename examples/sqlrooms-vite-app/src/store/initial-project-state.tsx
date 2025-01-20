import {
  AdjustmentsHorizontalIcon,
  BookOpenIcon,
  CircleStackIcon,
  InformationCircleIcon,
  MapIcon,
  TableCellsIcon,
} from '@heroicons/react/24/outline';
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
import ViewConfigPanel from '../components/view-config/ViewConfigPanel';
import AddDataModal from '../components/add-data/AddDataModal';

export const PROJECT_BUILDER_PANELS: Partial<
  Record<ProjectPanelTypes, ProjectPanelInfo>
> = {
  [ProjectPanelTypes.PROJECT_DETAILS]: {
    title: 'Project Details',
    icon: InformationCircleIcon,
    // DocumentTextIcon,
    component: ProjectDetailsPanel,
    placement: 'sidebar',
  },
  [ProjectPanelTypes.DATA_SOURCES]: {
    title: 'Data Sources',
    // icon: FolderIcon,
    icon: CircleStackIcon,
    component: () => <DataSourcesPanel AddDataModal={AddDataModal} />,
    placement: 'sidebar',
  },
  [ProjectPanelTypes.VIEW_CONFIGURATION]: {
    title: 'View Config',
    icon: AdjustmentsHorizontalIcon,
    component: () => <ViewConfigPanel />,
    placement: 'sidebar',
  },
  [ProjectPanelTypes.DATA_TABLES]: {
    title: 'Prepared Data Tables',
    // icon: CircleStackIcon,
    icon: TableCellsIcon,
    component: () => <div>Data Tables</div>,
    placement: 'sidebar-bottom',
  },
  // [ProjectPanelTypes.CHARTS]: {
  //   title: 'Charts',
  //   icon: ChartBarIcon,
  //   component: ChartsPanel,
  //   placement: 'sidebar',
  // },
  [ProjectPanelTypes.MAIN_VIEW]: {
    title: 'Main view',
    icon: MapIcon,
    component: () => <div>Main view</div>,
    placement: 'main',
  },
  [ProjectPanelTypes.DOCS]: {
    title: 'Documentation',
    icon: BookOpenIcon,
    component: () => <div>Documentation</div>,
    placement: 'top-bar',
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
