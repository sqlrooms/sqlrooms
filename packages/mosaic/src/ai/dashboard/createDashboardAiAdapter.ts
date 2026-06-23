import {
  hasCommandSliceState,
  type RoomCommandResult,
} from '@sqlrooms/room-store';
import {DashboardAiAdapter} from './dashboard-types';
import {MosaicDashboardStoreState} from '../../dashboard/MosaicDashboardSlice';
import {MOSAIC_DASHBOARD_COMMAND_IDS} from '../../dashboard/MosaicDashboardCommands';
import {AiStore} from '../types';

function getCommands(store: AiStore<MosaicDashboardStoreState>) {
  const state = store.getState();
  return hasCommandSliceState(state) ? state.commands : undefined;
}

function hasCommand(
  store: AiStore<MosaicDashboardStoreState>,
  commandId: string,
) {
  return Boolean(getCommands(store)?.getCommand(commandId));
}

function assertCommandSuccess(result: RoomCommandResult, commandId: string) {
  if (!result.success) {
    throw new Error(
      result.error ?? result.message ?? `Command "${commandId}" failed.`,
    );
  }
}

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
    setSelectedTable: async (tableName) => {
      const commandId = MOSAIC_DASHBOARD_COMMAND_IDS.setSelectedTable;
      if (!hasCommand(store, commandId)) {
        store
          .getState()
          .mosaicDashboard.setSelectedTable(dashboardId, tableName);
        return;
      }
      const result = await getCommands(store)!.invokeCommand(
        commandId,
        {dashboardId, tableName},
        {surface: 'ai', actor: 'dashboard-ai-adapter'},
      );
      assertCommandSuccess(result, commandId);
    },
    addPanel: async (panel) => {
      const commandId = MOSAIC_DASHBOARD_COMMAND_IDS.addPanel;
      if (!hasCommand(store, commandId)) {
        return store.getState().mosaicDashboard.addPanel(dashboardId, panel);
      }
      const result = await getCommands(store)!.invokeCommand(
        commandId,
        {dashboardId, panel},
        {surface: 'ai', actor: 'dashboard-ai-adapter'},
      );
      assertCommandSuccess(result, commandId);
      return (
        (result.data as {panelId?: string} | undefined)?.panelId ?? panel.id
      );
    },
    updatePanel: async (panelId, patch) => {
      const commandId = MOSAIC_DASHBOARD_COMMAND_IDS.updatePanel;
      if (!hasCommand(store, commandId)) {
        store
          .getState()
          .mosaicDashboard.updatePanel(dashboardId, panelId, patch);
        return;
      }
      const result = await getCommands(store)!.invokeCommand(
        commandId,
        {dashboardId, panelId, patch},
        {surface: 'ai', actor: 'dashboard-ai-adapter'},
      );
      assertCommandSuccess(result, commandId);
    },
    removePanel: async (panelId) => {
      const commandId = MOSAIC_DASHBOARD_COMMAND_IDS.removePanel;
      if (!hasCommand(store, commandId)) {
        store.getState().mosaicDashboard.removePanel(dashboardId, panelId);
        return;
      }
      const result = await getCommands(store)!.invokeCommand(
        commandId,
        {dashboardId, panelId},
        {surface: 'ai', actor: 'dashboard-ai-adapter'},
      );
      assertCommandSuccess(result, commandId);
    },
    getPanel: (panelId) =>
      store
        .getState()
        .mosaicDashboard.getDashboard(dashboardId)
        ?.panels.find((panel) => panel.id === panelId),
    getPanelIssue: (panelId) =>
      store.getState().mosaicDashboard.getPanelIssue(dashboardId, panelId),
  };
}
