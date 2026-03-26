import {
  createRoomShellSlice,
  createRoomStore,
  LayoutConfig,
  RoomShellSliceState,
} from '@sqlrooms/room-shell';
import {
  BarChart3Icon,
  DatabaseIcon,
  LayoutDashboardIcon,
  TableIcon,
  TableRowsSplitIcon,
  TerminalIcon,
} from 'lucide-react';
import {ConsolePanel} from './panels/ConsolePanel';
import {DataSourcesPanel} from './panels/DataSourcesPanel';
import {DynamicChartPanel} from './panels/DynamicChartPanel';
import {ResultsPanel} from './panels/ResultsPanel';
import {SchemaPanel} from './panels/SchemaPanel';

export type RoomState = RoomShellSliceState & {
  addDashboard: (areaId?: string) => void;
};

const CHART_LABELS = [
  'Revenue',
  'Users',
  'Conversions',
  'Sessions',
  'Bounce Rate',
  'Retention',
  'Signups',
  'Churn',
  'MRR',
  'ARPU',
];

let dashboardCounter = 0;

export const {roomStore, useRoomStore} = createRoomStore<RoomState>(
  (set, get, store) => ({
    ...createRoomShellSlice({
      layout: {
        config: {
          type: 'mosaic',
          nodes: {
            type: 'split',
            direction: 'row',
            children: [
              {
                type: 'tabs',
                id: 'left',
                tabs: ['data-sources', 'schema'],
                activeTabIndex: 0,
                collapsible: true,
                showTabStrip: false,
              },
              {
                type: 'split',
                direction: 'column',
                children: [
                  {
                    type: 'tabs',
                    id: 'main',
                    tabs: ['dashboard-overview', 'dashboard-growth'],
                    activeTabIndex: 0,
                    showTabStrip: true,
                    creatableTabs: true,
                    closeableTabs: true,
                    searchableTabs: true,
                  },
                  {
                    type: 'tabs',
                    id: 'bottom',
                    tabs: ['console', 'results'],
                    activeTabIndex: 0,
                    collapsible: true,
                    showTabStrip: true,
                    showTabStripWhenCollapsed: true,
                  },
                ],
                splitPercentages: [70, 30],
              },
            ],
            splitPercentages: [22, 78],
          },
        } satisfies LayoutConfig,
        panels: {
          'data-sources': {
            title: 'Data Sources',
            component: DataSourcesPanel,
            icon: DatabaseIcon,
            area: 'left',
          },
          schema: {
            title: 'Schema',
            component: SchemaPanel,
            icon: TableIcon,
            area: 'left',
          },
          'dashboard-overview': {
            title: 'Overview',
            component: () => <DynamicChartPanel label="Overview" />,
            icon: LayoutDashboardIcon,
            area: 'main',
          },
          'dashboard-growth': {
            title: 'Growth',
            component: () => <DynamicChartPanel label="Growth" />,
            icon: LayoutDashboardIcon,
            area: 'main',
          },
          console: {
            title: 'Console',
            component: ConsolePanel,
            icon: TerminalIcon,
            area: 'bottom',
          },
          results: {
            title: 'Results',
            component: ResultsPanel,
            icon: TableRowsSplitIcon,
            area: 'bottom',
          },
        },
      },
    })(set, get, store),

    addDashboard: (areaId = 'main') => {
      dashboardCounter += 1;
      const label = CHART_LABELS[(dashboardCounter - 1) % CHART_LABELS.length]!;
      const panelId = `dashboard-${label.toLowerCase().replace(/\s+/g, '-')}-${dashboardCounter}`;

      get().layout.registerPanel(panelId, {
        title: label,
        icon: BarChart3Icon,
        component: () => <DynamicChartPanel label={label} />,
        area: areaId,
      });
      get().layout.addPanelToArea(areaId, panelId);
    },
  }),
);
