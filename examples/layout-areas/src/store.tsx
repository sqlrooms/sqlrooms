import {MosaicLayoutNode} from '@sqlrooms/layout-config';
import {
  createRoomShellSlice,
  createRoomStore,
  LayoutConfig,
  RoomShellSliceState,
  RoomPanelInfo,
} from '@sqlrooms/room-shell';
import {produce} from 'immer';
import {
  BarChart3Icon,
  DatabaseIcon,
  LayoutDashboardIcon,
  TableIcon,
  TableRowsSplitIcon,
  TerminalIcon,
} from 'lucide-react';
import {ConsolePanel} from './panels/ConsolePanel';
import {DashboardPanel} from './panels/DashboardPanel';
import {DataSourcesPanel} from './panels/DataSourcesPanel';
import {DynamicChartPanel} from './panels/DynamicChartPanel';
import {ResultsPanel} from './panels/ResultsPanel';
import {SchemaPanel} from './panels/SchemaPanel';

export type RoomState = RoomShellSliceState & {
  dashboard: {
    nodes: MosaicLayoutNode | null;
    panels: Record<string, RoomPanelInfo>;
    setNodes: (nodes: MosaicLayoutNode | null) => void;
    addChart: () => void;
  };
};

let chartCounter = 0;

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
                  'dashboard',
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
          dashboard: {
            title: 'Dashboard',
            icon: LayoutDashboardIcon,
            component: DashboardPanel,
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

    dashboard: {
      nodes: {
        type: 'split',
        direction: 'row',
        draggable: true,
        children: ['chart-a', 'chart-b', 'chart-c'],
        splitPercentages: [34, 33, 33],
      },
      panels: {
        'chart-a': {
          title: 'Revenue',
          component: () => <DynamicChartPanel label="Revenue" />,
          icon: BarChart3Icon,
        },
        'chart-b': {
          title: 'Users',
          component: () => <DynamicChartPanel label="Users" />,
          icon: BarChart3Icon,
        },
        'chart-c': {
          title: 'Conversions',
          component: () => <DynamicChartPanel label="Conversions" />,
          icon: BarChart3Icon,
        },
      },
      setNodes: (nodes) =>
        set((state) =>
          produce(state, (draft) => {
            draft.dashboard.nodes = nodes;
          }),
        ),
      addChart: () => {
        chartCounter += 1;
        const n = chartCounter;
        const panelId = `chart-${n}`;
        const label = `Chart ${n}`;

        set((state) =>
          produce(state, (draft) => {
            draft.dashboard.panels[panelId] = {
              title: label,
              icon: BarChart3Icon,
              component: () => <DynamicChartPanel label={label} />,
            };
            const nodes = draft.dashboard.nodes;
            if (!nodes) {
              draft.dashboard.nodes = panelId;
            } else if (typeof nodes === 'string') {
              draft.dashboard.nodes = {
                type: 'split',
                direction: 'row',
                children: [nodes, panelId],
                splitPercentages: [50, 50],
              };
            } else if ('children' in nodes) {
              nodes.children.push(panelId);
              const count = nodes.children.length;
              nodes.splitPercentages = Array(count).fill(
                Math.round(100 / count),
              );
            }
          }),
        );
      },
    },
  }),
);
