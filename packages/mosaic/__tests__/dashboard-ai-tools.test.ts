import {jest} from '@jest/globals';
import {createDashboardAiTools} from '../src/ai/dashboard/createDashboardAiTools';
import {createDashboardAiAdapter} from '../src/ai/dashboard/createDashboardAiAdapter';
import {createDashboardAgentTool} from '../src/ai/dashboard/createDashboardAgentTool';
import {KnownDashboardTools} from '../src/ai/dashboard/constants';
import type {DatabaseAiAdapter} from '../src/ai/database-types';
import type {DashboardAiAdapter} from '../src/ai/dashboard/dashboard-types';
import {MOSAIC_DASHBOARD_CHART_PANEL_TYPE} from '../src/dashboard/dashboard-types';
import {MOSAIC_DASHBOARD_COMMAND_IDS} from '../src/dashboard/MosaicDashboardCommands';

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

  it('updates an existing chart panel when chart tools receive panelId', async () => {
    const addPanel = jest.fn(() => 'new-panel');
    const updatePanel = jest.fn();
    const setSelectedTable = jest.fn();
    const dashboardAdapter: DashboardAiAdapter = {
      getPanel: () => ({
        id: 'panel-1',
        type: MOSAIC_DASHBOARD_CHART_PANEL_TYPE,
        title: 'Magnitude histogram',
        config: {
          chartType: 'histogram',
          settings: {field: 'magnitude'},
        },
      }),
      setSelectedTable,
      addPanel,
      updatePanel,
      removePanel: () => {},
    };

    const databaseAdapter: DatabaseAiAdapter = {
      getTables: () => [],
      findTable: () =>
        ({
          tableName: 'earthquakes',
          columns: [{name: 'depth', type: 'DOUBLE'}],
        }) as any,
    };

    const tools = createDashboardAiTools({
      databaseAdapter,
      dashboardAdapter,
    });

    const result = await (
      tools.create_dashboard_panel_histogram as any
    ).execute({
      tableName: 'earthquakes',
      panelId: 'panel-1',
      title: 'Depth histogram',
      settings: {field: 'depth'},
      reasoning: 'update the existing histogram',
    });

    expect(result.success).toBe(true);
    expect(addPanel).not.toHaveBeenCalled();
    expect(setSelectedTable).toHaveBeenCalledWith('earthquakes');
    expect(updatePanel).toHaveBeenCalledWith('panel-1', {
      title: 'Depth histogram',
      config: {
        chartType: 'histogram',
        settings: {field: 'depth'},
      },
    });
  });

  it('returns an error when panelId references a missing panel', async () => {
    const updatePanel = jest.fn();
    const dashboardAdapter: DashboardAiAdapter = {
      getPanel: () => undefined,
      setSelectedTable: () => {},
      addPanel: () => 'new-panel',
      updatePanel,
      removePanel: () => {},
    };

    const databaseAdapter: DatabaseAiAdapter = {
      getTables: () => [],
      findTable: () =>
        ({
          tableName: 'earthquakes',
          columns: [{name: 'depth', type: 'DOUBLE'}],
        }) as any,
    };

    const tools = createDashboardAiTools({
      databaseAdapter,
      dashboardAdapter,
    });

    const result = await (
      tools.create_dashboard_panel_histogram as any
    ).execute({
      tableName: 'earthquakes',
      panelId: 'missing-panel',
      title: 'Depth histogram',
      settings: {field: 'depth'},
      reasoning: 'update a missing panel',
    });

    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain('Panel "missing-panel" not found');
    expect(updatePanel).not.toHaveBeenCalled();
  });

  it('returns an error when panelId references a non-chart panel', async () => {
    const updatePanel = jest.fn();
    const dashboardAdapter: DashboardAiAdapter = {
      getPanel: () => ({
        id: 'panel-1',
        type: 'data-table-explorer',
        title: 'Data Explorer',
        config: {},
      }),
      setSelectedTable: () => {},
      addPanel: () => 'new-panel',
      updatePanel,
      removePanel: () => {},
    };

    const databaseAdapter: DatabaseAiAdapter = {
      getTables: () => [],
      findTable: () =>
        ({
          tableName: 'earthquakes',
          columns: [{name: 'depth', type: 'DOUBLE'}],
        }) as any,
    };

    const tools = createDashboardAiTools({
      databaseAdapter,
      dashboardAdapter,
    });

    const result = await (
      tools.create_dashboard_panel_histogram as any
    ).execute({
      tableName: 'earthquakes',
      panelId: 'panel-1',
      title: 'Depth histogram',
      settings: {field: 'depth'},
      reasoning: 'update a non-chart panel',
    });

    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain(
      'Panel "panel-1" is not a chart panel',
    );
    expect(updatePanel).not.toHaveBeenCalled();
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

describe('createDashboardAiAdapter', () => {
  it('routes dashboard mutations through commands when registered', async () => {
    const invokeCommand = jest.fn(async (commandId, input) => ({
      success: true,
      commandId,
      data:
        commandId === MOSAIC_DASHBOARD_COMMAND_IDS.addPanel
          ? {panelId: (input as any).panel.id}
          : undefined,
    }));
    const directAddPanel = jest.fn(() => 'direct-panel');
    const store = {
      getState: () =>
        ({
          commands: {
            getCommand: (commandId: string) =>
              Object.values(MOSAIC_DASHBOARD_COMMAND_IDS).includes(
                commandId as any,
              )
                ? {id: commandId}
                : undefined,
            invokeCommand,
            registerCommands: jest.fn(),
            unregisterCommands: jest.fn(),
            listCommands: jest.fn(),
            executeCommand: jest.fn(),
          },
          mosaicDashboard: {
            getDashboard: () => ({selectedTable: undefined, panels: []}),
            setSelectedTable: jest.fn(),
            addPanel: directAddPanel,
            updatePanel: jest.fn(),
            removePanel: jest.fn(),
            getPanelIssue: jest.fn(),
          },
        }) as any,
    };
    const adapter = createDashboardAiAdapter(store as any, 'dashboard-1');
    const panel = {
      id: 'panel-1',
      type: MOSAIC_DASHBOARD_CHART_PANEL_TYPE,
      title: 'Chart',
      config: {chartType: 'histogram', settings: {field: 'magnitude'}},
    };

    await adapter.setSelectedTable('earthquakes');
    const panelId = await adapter.addPanel(panel);

    expect(panelId).toBe('panel-1');
    expect(directAddPanel).not.toHaveBeenCalled();
    expect(invokeCommand).toHaveBeenCalledWith(
      MOSAIC_DASHBOARD_COMMAND_IDS.setSelectedTable,
      {dashboardId: 'dashboard-1', tableName: 'earthquakes'},
      {surface: 'ai', actor: 'dashboard-ai-adapter'},
    );
    expect(invokeCommand).toHaveBeenCalledWith(
      MOSAIC_DASHBOARD_COMMAND_IDS.addPanel,
      {dashboardId: 'dashboard-1', panel},
      {surface: 'ai', actor: 'dashboard-ai-adapter'},
    );
  });
});
