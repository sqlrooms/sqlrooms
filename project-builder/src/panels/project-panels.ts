import {ProjectPanelTypes} from '@flowmapcity/project-config';
import {
  AdjustmentsHorizontalIcon,
  BookOpenIcon,
  ChartBarIcon,
  CircleStackIcon,
  FunnelIcon,
  InformationCircleIcon,
  MapIcon,
  TableCellsIcon,
} from '@heroicons/react/24/outline';
import ChartsPanel from './charts-panel/ChartsPanel';
import DataSourcesPanel from './data-sources/DataSourcesPanel';
import DataTablesPanel from './data-tables-panel/DataTablesPanel';
import DocumentationPanel from './docs-panel/DocumentationPanel';
import FiltersPanel from './filters-panel/FiltersPanel';
import MainViewPanel from './main-panel/MainViewPanel';
import ProjectDetailsPanel from './project-details-panel/ProjectDetailsPanel';
import ViewConfigPanel from './view-config-panel/ViewConfigPanel';

export type ProjectPanelInfo = {
  title: string;
  icon: React.ComponentType<any>;
  component: React.ComponentType<any>;
  placement: 'sidebar' | 'top-bar';
};

export const DEFAULT_PROJECT_BUILDER_PANELS: Record<
  ProjectPanelTypes,
  ProjectPanelInfo
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
    component: DataSourcesPanel,
    placement: 'sidebar',
  },
  [ProjectPanelTypes.VIEW_CONFIGURATION]: {
    title: 'View Config',
    icon: AdjustmentsHorizontalIcon,
    component: ViewConfigPanel,
    placement: 'sidebar',
  },
  [ProjectPanelTypes.FILTERS]: {
    title: 'Filter',
    icon: FunnelIcon,
    component: FiltersPanel,
    placement: 'sidebar',
  },
  [ProjectPanelTypes.DATA_TABLES]: {
    title: 'Data Tables',
    // icon: CircleStackIcon,
    icon: TableCellsIcon,
    component: DataTablesPanel,
    placement: 'sidebar',
  },
  [ProjectPanelTypes.CHARTS]: {
    title: 'Charts',
    icon: ChartBarIcon,
    component: ChartsPanel,
    placement: 'sidebar',
  },
  [ProjectPanelTypes.MAIN_VIEW]: {
    title: 'Main view',
    icon: MapIcon,
    component: MainViewPanel,
    placement: 'sidebar',
  },
  [ProjectPanelTypes.DOCS]: {
    title: 'Documentation',
    icon: BookOpenIcon,
    component: DocumentationPanel,
    placement: 'top-bar',
  },
};
