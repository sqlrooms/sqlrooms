import type {BaseRoomStoreState, RoomCommand} from '@sqlrooms/room-store';
import {z} from 'zod';
import type {
  MosaicDashboardEntry,
  MosaicDashboardPanelConfig,
} from './dashboard-types';
import {
  ChartPanelConfig,
  DataTableExplorerPanel,
  MOSAIC_DASHBOARD_CHART_PANEL_TYPE,
  MOSAIC_DASHBOARD_DATA_TABLE_EXPLORER_PANEL_TYPE,
  MosaicDashboardPanelConfig as MosaicDashboardPanelConfigSchema,
} from './dashboard-types';
import {MosaicDashboardPanelSource} from './core-types';
import type {MosaicDashboardSliceState} from './MosaicDashboardSlice';

export const MOSAIC_DASHBOARD_COMMAND_IDS = {
  setSelectedTable: 'dashboard.set-selected-table',
  addPanel: 'dashboard.add-panel',
  updatePanel: 'dashboard.update-panel',
  removePanel: 'dashboard.remove-panel',
} as const;

const DashboardSetSelectedTableInput = z.object({
  dashboardId: z.string().describe('Target dashboard ID.'),
  tableName: z.string().min(1).describe('Selected Mosaic table name.'),
});

const DashboardAddPanelInput = z.object({
  dashboardId: z.string().describe('Target dashboard ID.'),
  panel: MosaicDashboardPanelConfigSchema.describe('Panel config to add.'),
});

const DashboardUpdatePanelInput = z.object({
  dashboardId: z.string().describe('Target dashboard ID.'),
  panelId: z.string().describe('Dashboard panel ID to update.'),
  patch: z
    .object({
      title: z.string().optional(),
      type: z.string().min(1).optional(),
      source: MosaicDashboardPanelSource.optional(),
      config: z.record(z.string(), z.unknown()).optional(),
    })
    .describe('Partial panel config patch.'),
});

const DashboardRemovePanelInput = z.object({
  dashboardId: z.string().describe('Target dashboard ID.'),
  panelId: z.string().describe('Dashboard panel ID to remove.'),
});

type DashboardCommandState = BaseRoomStoreState & MosaicDashboardSliceState;

function dashboardMissing(commandId: string, dashboardId: string) {
  return {
    success: false,
    commandId,
    code: 'dashboard-not-found',
    error: `Unknown dashboard "${dashboardId}".`,
  };
}

function panelMissing(commandId: string, panelId: string) {
  return {
    success: false,
    commandId,
    code: 'dashboard-panel-not-found',
    error: `Unknown dashboard panel "${panelId}".`,
  };
}

function panelData(
  dashboardId: string,
  panel: MosaicDashboardPanelConfig,
  selectedTable?: string,
) {
  return {
    dashboardId,
    panelId: panel.id,
    panelType: panel.type,
    title: panel.title,
    selectedTable,
  };
}

function getPanel(
  dashboard: MosaicDashboardEntry,
  panelId: string,
): MosaicDashboardPanelConfig | undefined {
  return dashboard.panels.find((panel) => panel.id === panelId);
}

/**
 * Create reusable Mosaic dashboard commands for selected table and panel
 * mutations.
 *
 * These commands delegate to the dashboard slice so UI code, agents, and
 * future automation share the same persistence behavior.
 */
export function createMosaicDashboardCommands<
  TRoomState extends DashboardCommandState = DashboardCommandState,
>(): RoomCommand<TRoomState>[] {
  return [
    {
      id: MOSAIC_DASHBOARD_COMMAND_IDS.setSelectedTable,
      name: 'Set dashboard selected table',
      description: 'Set the selected source table for a Mosaic dashboard.',
      group: 'Dashboard',
      keywords: ['dashboard', 'table', 'select', 'mosaic'],
      inputSchema: DashboardSetSelectedTableInput,
      inputDescription: 'Dashboard ID and table name.',
      metadata: {readOnly: false, idempotent: true, riskLevel: 'low'},
      execute: ({getState}, input) => {
        const {dashboardId, tableName} = input as z.infer<
          typeof DashboardSetSelectedTableInput
        >;
        const state = getState();
        const dashboard = state.mosaicDashboard.getDashboard(dashboardId);
        const previousSelectedTable = dashboard?.selectedTable;
        state.mosaicDashboard.setSelectedTable(dashboardId, tableName);
        return {
          success: true,
          commandId: MOSAIC_DASHBOARD_COMMAND_IDS.setSelectedTable,
          message: `Set dashboard "${dashboardId}" selected table to "${tableName}".`,
          data: {
            dashboardId,
            selectedTable: tableName,
            previousSelectedTable,
          },
        };
      },
    },
    {
      id: MOSAIC_DASHBOARD_COMMAND_IDS.addPanel,
      name: 'Add dashboard panel',
      description: 'Add a panel to a Mosaic dashboard.',
      group: 'Dashboard',
      keywords: ['dashboard', 'panel', 'add', 'chart', 'table'],
      inputSchema: DashboardAddPanelInput,
      inputDescription: 'Dashboard ID and panel config.',
      metadata: {readOnly: false, idempotent: false, riskLevel: 'medium'},
      execute: ({getState}, input) => {
        const {dashboardId, panel} = input as z.infer<
          typeof DashboardAddPanelInput
        >;
        const state = getState();
        state.mosaicDashboard.addPanel(dashboardId, panel);
        const dashboard = state.mosaicDashboard.getDashboard(dashboardId);
        return {
          success: true,
          commandId: MOSAIC_DASHBOARD_COMMAND_IDS.addPanel,
          message: `Added "${panel.title}" panel to dashboard "${dashboardId}".`,
          data: panelData(dashboardId, panel, dashboard?.selectedTable),
        };
      },
    },
    {
      id: MOSAIC_DASHBOARD_COMMAND_IDS.updatePanel,
      name: 'Update dashboard panel',
      description: 'Update an existing Mosaic dashboard panel.',
      group: 'Dashboard',
      keywords: ['dashboard', 'panel', 'update', 'chart'],
      inputSchema: DashboardUpdatePanelInput,
      inputDescription: 'Dashboard ID, panel ID, and partial panel patch.',
      metadata: {readOnly: false, idempotent: false, riskLevel: 'medium'},
      execute: ({getState}, input) => {
        const {dashboardId, panelId, patch} = input as z.infer<
          typeof DashboardUpdatePanelInput
        >;
        const state = getState();
        const dashboard = state.mosaicDashboard.getDashboard(dashboardId);
        if (!dashboard) {
          return dashboardMissing(
            MOSAIC_DASHBOARD_COMMAND_IDS.updatePanel,
            dashboardId,
          );
        }
        const existingPanel = getPanel(dashboard, panelId);
        if (!existingPanel) {
          return panelMissing(
            MOSAIC_DASHBOARD_COMMAND_IDS.updatePanel,
            panelId,
          );
        }
        const panelValidation = validatePanelConfig({
          ...existingPanel,
          ...patch,
          id: panelId,
        });
        if (!panelValidation.success) {
          return {
            success: false,
            commandId: MOSAIC_DASHBOARD_COMMAND_IDS.updatePanel,
            code: 'invalid-dashboard-panel-patch',
            error: 'Dashboard panel patch does not match the panel type.',
            data: {
              dashboardId,
              panelId,
              issues: panelValidation.error.issues,
            },
          };
        }
        state.mosaicDashboard.updatePanel(
          dashboardId,
          panelId,
          stripPanelId(panelValidation.data),
        );
        const updatedDashboard =
          state.mosaicDashboard.getDashboard(dashboardId);
        const updatedPanel = updatedDashboard
          ? getPanel(updatedDashboard, panelId)
          : undefined;
        return {
          success: true,
          commandId: MOSAIC_DASHBOARD_COMMAND_IDS.updatePanel,
          message: `Updated dashboard panel "${panelId}".`,
          data: updatedPanel
            ? {
                ...panelData(
                  dashboardId,
                  updatedPanel,
                  updatedDashboard?.selectedTable,
                ),
                previousTitle: existingPanel.title,
              }
            : {dashboardId, panelId},
        };
      },
    },
    {
      id: MOSAIC_DASHBOARD_COMMAND_IDS.removePanel,
      name: 'Remove dashboard panel',
      description: 'Remove a panel from a Mosaic dashboard.',
      group: 'Dashboard',
      keywords: ['dashboard', 'panel', 'remove', 'delete'],
      inputSchema: DashboardRemovePanelInput,
      inputDescription: 'Dashboard ID and panel ID.',
      metadata: {readOnly: false, idempotent: false, riskLevel: 'medium'},
      execute: ({getState}, input) => {
        const {dashboardId, panelId} = input as z.infer<
          typeof DashboardRemovePanelInput
        >;
        const state = getState();
        const dashboard = state.mosaicDashboard.getDashboard(dashboardId);
        if (!dashboard) {
          return dashboardMissing(
            MOSAIC_DASHBOARD_COMMAND_IDS.removePanel,
            dashboardId,
          );
        }
        const panel = getPanel(dashboard, panelId);
        if (!panel) {
          return panelMissing(
            MOSAIC_DASHBOARD_COMMAND_IDS.removePanel,
            panelId,
          );
        }
        state.mosaicDashboard.removePanel(dashboardId, panelId);
        return {
          success: true,
          commandId: MOSAIC_DASHBOARD_COMMAND_IDS.removePanel,
          message: `Removed dashboard panel "${panelId}".`,
          data: {
            ...panelData(dashboardId, panel, dashboard.selectedTable),
            removedPanel: panel,
          },
        };
      },
    },
  ];
}

function stripPanelId(
  panel: MosaicDashboardPanelConfig,
): Partial<Omit<MosaicDashboardPanelConfig, 'id'>> {
  const {id: _id, ...patch} = panel;
  return patch;
}

function validatePanelConfig(
  panel: unknown,
):
  | {success: true; data: MosaicDashboardPanelConfig}
  | {success: false; error: z.ZodError} {
  const panelType =
    typeof panel === 'object' && panel !== null && 'type' in panel
      ? (panel as {type?: unknown}).type
      : undefined;
  if (panelType === MOSAIC_DASHBOARD_CHART_PANEL_TYPE) {
    return ChartPanelConfig.safeParse(panel);
  }
  if (panelType === MOSAIC_DASHBOARD_DATA_TABLE_EXPLORER_PANEL_TYPE) {
    return DataTableExplorerPanel.safeParse(panel);
  }
  return MosaicDashboardPanelConfigSchema.safeParse(panel);
}
