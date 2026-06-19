import {DashboardAiAdapter} from './dashboard-types';
import {MosaicDashboardStoreState} from '../../dashboard/MosaicDashboardSlice';
import {AiStore} from '../types';

export function createDashboardAiAdapter<
  TState extends MosaicDashboardStoreState,
>(store: AiStore<TState>, dashboardId: string): DashboardAiAdapter {
  return {
    getDashboard: () =>
      store.getState().mosaicDashboard.getDashboard(dashboardId),
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
