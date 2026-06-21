import {jest} from '@jest/globals';
import {createDashboardAiTools} from '../src/ai/dashboard/createDashboardAiTools';
import {createDashboardAgentTool} from '../src/ai/dashboard/createDashboardAgentTool';
import {KnownDashboardTools} from '../src/ai/dashboard/constants';
import type {DatabaseAiAdapter} from '../src/ai/database-types';
import type {DashboardAiAdapter} from '../src/ai/dashboard/dashboard-types';
import {MOSAIC_DASHBOARD_CHART_PANEL_TYPE} from '../src/dashboard/dashboard-types';

describe('createDashboardAiTools', () => {
  it('lists dashboard panels with selected table and runtime issues', async () => {
    const dashboardAdapter: DashboardAiAdapter = {
      getSelectedTable: () => 'earthquakes',
      getPanels: () => [
        {
          id: 'panel-1',
          type: MOSAIC_DASHBOARD_CHART_PANEL_TYPE,
          title: 'Magnitude histogram',
          config: {
            chartType: 'test-chart',
            settings: {},
          },
        },
      ],
      getPanelIssue: () => ({
        kind: 'render-error',
        panelId: 'panel-1',
        chartType: 'test-chart',
        message: 'Example render issue',
        recoverable: true,
      }),
      setSelectedTable: () => {},
      addPanel: () => 'panel-1',
      updatePanel: () => {},
      removePanel: () => {},
      getPanel: () => undefined,
    };

    const databaseAdapter: DatabaseAiAdapter = {
      getTables: () => [],
      findTable: () => undefined,
    };

    const tools = createDashboardAiTools({
      databaseAdapter,
      dashboardAdapter,
    });

    const result = await (
      tools[KnownDashboardTools.list_dashboard_panels] as any
    ).execute({});

    expect(result).toEqual({
      success: true,
      selectedTable: 'earthquakes',
      panels: [
        {
          id: 'panel-1',
          type: MOSAIC_DASHBOARD_CHART_PANEL_TYPE,
          title: 'Magnitude histogram',
          config: {
            chartType: 'test-chart',
            settings: {},
          },
          issue: {
            kind: 'render-error',
            panelId: 'panel-1',
            chartType: 'test-chart',
            message: 'Example render issue',
            recoverable: true,
          },
        },
      ],
    });
  });
});

describe('createDashboardAgentTool', () => {
  it('uses the dashboard selected table when tableName is omitted', async () => {
    const setSelectedTable = jest.fn();
    const runSubAgent = jest.fn(async () => ({
      finalOutput: 'done',
      agentToolCalls: [],
    }));

    const store = {
      getState: () => ({
        mosaicDashboard: {
          getDashboard: () => ({
            id: 'dashboard-1',
            title: 'Dashboard',
            layoutType: 'grid',
            selectedTable: 'earthquakes',
            panels: [],
            layout: null,
            updatedAt: 0,
          }),
          setSelectedTable,
          addPanel: () => 'panel-1',
          updatePanel: () => {},
          removePanel: () => {},
          getPanelIssue: () => undefined,
        },
      }),
    };

    const tool = createDashboardAgentTool({
      store: store as any,
      databaseAdapter: {
        getTables: () => [],
        findTable: (tableName) =>
          tableName === 'earthquakes'
            ? ({
                tableName: 'earthquakes',
                columns: [],
              } as any)
            : undefined,
      },
      getModel: () => ({}) as any,
      runSubAgent,
    });

    const result = await (tool as any).execute({
      dashboardId: 'dashboard-1',
      intent: 'add a histogram of magnitude',
      reasoning: 'user asked to update the dashboard',
    });

    expect(result).toMatchObject({
      success: true,
      dashboardId: 'dashboard-1',
      metadata: {tableName: 'earthquakes'},
    });
    expect(setSelectedTable).toHaveBeenCalledWith('dashboard-1', 'earthquakes');
    expect(runSubAgent).toHaveBeenCalledTimes(1);
  });
});
