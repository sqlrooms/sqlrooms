import {
  createRoomShellSlice,
  createRoomStore,
  LayoutConfig,
  RoomShellSliceState,
} from '@sqlrooms/room-shell';
import {
  BarChart3Icon,
  CodeIcon,
  DatabaseIcon,
  TableIcon,
  TableRowsSplitIcon,
  TerminalIcon,
} from 'lucide-react';
import {ChartPanel} from './panels/ChartPanel';
import {ConsolePanel} from './panels/ConsolePanel';
import {DataSourcesPanel} from './panels/DataSourcesPanel';
import {EditorPanel} from './panels/EditorPanel';
import {ResultsPanel} from './panels/ResultsPanel';
import {SchemaPanel} from './panels/SchemaPanel';

export type RoomState = RoomShellSliceState;

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
                    tabs: ['editor', 'chart'],
                    activeTabIndex: 0,
                    closeableTabs: true,
                    creatableTabs: true,
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
          editor: {
            title: 'Editor',
            component: EditorPanel,
            icon: CodeIcon,
            area: 'main',
          },
          chart: {
            title: 'Chart',
            component: ChartPanel,
            icon: BarChart3Icon,
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
  }),
);
