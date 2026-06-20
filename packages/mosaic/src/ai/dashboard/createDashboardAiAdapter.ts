import {DashboardAiAdapter} from './dashboard-types';
import {MosaicDashboardStoreState} from '../../dashboard/MosaicDashboardSlice';
import {AiStore} from '../types';

/**
 * Creates a dashboard adapter for AI operations scoped to a specific dashboard.
 * The adapter provides methods for managing panels, tables, and dashboard state.
 *
 * @template TState - Store state type extending MosaicDashboardStoreState
 * @param store - Zustand store instance with dashboard management capabilities
 * @param dashboardId - ID of the dashboard to scope adapter operations to
 * @returns Dashboard adapter instance with panel and table management methods
 */
export function createDashboardAiAdapter<
  TState extends MosaicDashboardStoreState,
>(store: AiStore<TState>, dashboardId: string): DashboardAiAdapter {
  return {
    getSelectedTable: () =>
      store.getState().mosaicDashboard.getDashboard(dashboardId)?.selectedTable,
    getPanels: () =>
      store.getState().mosaicDashboard.getDashboard(dashboardId)?.panels ?? [],
    setSelectedTable: (tableName) =>
      store.getState().mosaicDashboard.setSelectedTable(dashboardId, tableName),
    addPanel: (panel) =>
      store.getState().mosaicDashboard.addPanel(dashboardId, panel),
    updatePanel: (panelId, patch) =>
      store.getState().mosaicDashboard.updatePanel(dashboardId, panelId, patch),
    removePanel: (panelId) =>
      store.getState().mosaicDashboard.removePanel(dashboardId, panelId),
    getPanel: (panelId) =>
      store
        .getState()
        .mosaicDashboard.getDashboard(dashboardId)
        ?.panels.find((panel) => panel.id === panelId),
    getPanelIssue: (panelId) =>
      store.getState().mosaicDashboard.getPanelIssue(dashboardId, panelId),
  };
}
