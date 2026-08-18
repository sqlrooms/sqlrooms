import {createStore} from 'zustand';
import {createLayoutSlice} from '@sqlrooms/layout';
import {
  createBaseRoomSlice,
  createCommandSlice,
  type BaseRoomStoreState,
  type CommandSliceState,
} from '@sqlrooms/room-store';
import {
  createMosaicDashboardChartPanelConfig,
  createMosaicDashboardCommands,
  createMosaicDashboardSlice,
  MOSAIC_DASHBOARD_COMMAND_IDS,
  type MosaicDashboardSliceState,
} from '../src';
import {createMosaicSlice} from '../src/MosaicSlice';

type TestRoomState = BaseRoomStoreState &
  CommandSliceState &
  MosaicDashboardSliceState &
  any;

function createTestStore() {
  const store = createStore<TestRoomState>()((...args) => ({
    ...createBaseRoomSlice()(...args),
    ...createCommandSlice<TestRoomState>()(...args),
    ...createLayoutSlice()(...args),
    ...createMosaicSlice()(...args),
    ...createMosaicDashboardSlice()(...args),
  }));
  store
    .getState()
    .commands.registerCommands('test', createMosaicDashboardCommands());
  return store;
}

describe('Mosaic dashboard commands', () => {
  it('sets the selected table and returns previous selection data', async () => {
    const store = createTestStore();
    const dashboardId = 'dashboard-1';
    store.getState().mosaicDashboard.ensureDashboard(dashboardId);
    store.getState().mosaicDashboard.setSelectedTable(dashboardId, 'previous');

    const result = await store
      .getState()
      .commands.invokeCommand(MOSAIC_DASHBOARD_COMMAND_IDS.setSelectedTable, {
        dashboardId,
        tableName: 'earthquakes',
      });

    expect(result).toMatchObject({
      success: true,
      commandId: MOSAIC_DASHBOARD_COMMAND_IDS.setSelectedTable,
      data: {
        dashboardId,
        selectedTable: 'earthquakes',
        previousSelectedTable: 'previous',
      },
    });
    expect(
      store.getState().mosaicDashboard.getDashboard(dashboardId)?.selectedTable,
    ).toBe('earthquakes');
  });

  it('adds, updates, and removes dashboard panels', async () => {
    const store = createTestStore();
    const dashboardId = 'dashboard-1';
    store.getState().mosaicDashboard.ensureDashboard(dashboardId);
    const panel = createMosaicDashboardChartPanelConfig('Magnitude', {
      chartType: 'histogram',
      settings: {field: 'magnitude'},
    });

    const addResult = await store
      .getState()
      .commands.invokeCommand(MOSAIC_DASHBOARD_COMMAND_IDS.addPanel, {
        dashboardId,
        panel,
      });

    expect(addResult).toMatchObject({
      success: true,
      data: {
        dashboardId,
        panelId: panel.id,
        panelType: 'vgplot',
        title: 'Magnitude',
      },
    });

    const updateResult = await store
      .getState()
      .commands.invokeCommand(MOSAIC_DASHBOARD_COMMAND_IDS.updatePanel, {
        dashboardId,
        panelId: panel.id,
        patch: {title: 'Depth'},
      });

    expect(updateResult).toMatchObject({
      success: true,
      data: {
        dashboardId,
        panelId: panel.id,
        title: 'Depth',
        previousTitle: 'Magnitude',
      },
    });

    const removeResult = await store
      .getState()
      .commands.invokeCommand(MOSAIC_DASHBOARD_COMMAND_IDS.removePanel, {
        dashboardId,
        panelId: panel.id,
      });

    expect(removeResult).toMatchObject({
      success: true,
      data: {
        dashboardId,
        panelId: panel.id,
        removedPanel: expect.objectContaining({id: panel.id, title: 'Depth'}),
      },
    });
    expect(
      store.getState().mosaicDashboard.getDashboard(dashboardId)?.panels,
    ).toEqual([]);
  });

  it('rejects selected-table and panel additions for a missing dashboard', async () => {
    const store = createTestStore();
    const dashboardId = 'missing-dashboard';
    const panel = createMosaicDashboardChartPanelConfig('Magnitude', {
      chartType: 'histogram',
      settings: {field: 'magnitude'},
    });

    const selectedTableResult = await store
      .getState()
      .commands.invokeCommand(MOSAIC_DASHBOARD_COMMAND_IDS.setSelectedTable, {
        dashboardId,
        tableName: 'earthquakes',
      });
    const addPanelResult = await store
      .getState()
      .commands.invokeCommand(MOSAIC_DASHBOARD_COMMAND_IDS.addPanel, {
        dashboardId,
        panel,
      });

    expect(selectedTableResult).toMatchObject({
      success: false,
      commandId: MOSAIC_DASHBOARD_COMMAND_IDS.setSelectedTable,
      code: 'dashboard-not-found',
    });
    expect(addPanelResult).toMatchObject({
      success: false,
      commandId: MOSAIC_DASHBOARD_COMMAND_IDS.addPanel,
      code: 'dashboard-not-found',
    });
    expect(
      store.getState().mosaicDashboard.getDashboard(dashboardId),
    ).toBeUndefined();
  });

  it('returns a command failure when updating a missing panel', async () => {
    const store = createTestStore();
    const dashboardId = 'dashboard-1';
    store.getState().mosaicDashboard.ensureDashboard(dashboardId);

    const result = await store
      .getState()
      .commands.invokeCommand(MOSAIC_DASHBOARD_COMMAND_IDS.updatePanel, {
        dashboardId,
        panelId: 'missing',
        patch: {title: 'Nope'},
      });

    expect(result).toMatchObject({
      success: false,
      commandId: MOSAIC_DASHBOARD_COMMAND_IDS.updatePanel,
      code: 'dashboard-panel-not-found',
    });
  });

  it('rejects dashboard panel patches that would create invalid panel config', async () => {
    const store = createTestStore();
    const dashboardId = 'dashboard-1';
    const panel = createMosaicDashboardChartPanelConfig('Magnitude', {
      chartType: 'histogram',
      settings: {field: 'magnitude'},
    });
    store.getState().mosaicDashboard.ensureDashboard(dashboardId);
    store.getState().mosaicDashboard.addPanel(dashboardId, panel);

    const result = await store
      .getState()
      .commands.invokeCommand(MOSAIC_DASHBOARD_COMMAND_IDS.updatePanel, {
        dashboardId,
        panelId: panel.id,
        patch: {config: {pageSize: 25}},
      });

    expect(result).toMatchObject({
      success: false,
      commandId: MOSAIC_DASHBOARD_COMMAND_IDS.updatePanel,
      code: 'invalid-dashboard-panel-patch',
    });
    const storedPanel = store
      .getState()
      .mosaicDashboard.getDashboard(dashboardId)?.panels[0];

    expect(storedPanel?.id).toBe(panel.id);
    expect(storedPanel?.title).toBe('Magnitude');
    expect(storedPanel?.config).toEqual({
      chartType: 'histogram',
      settings: {field: 'magnitude'},
    });
  });
});
