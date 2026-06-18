import {createMosaicDashboardDataTableExplorerPanelConfig} from '../dashboard/MosaicDashboardSlice';
import {
  MOSAIC_DASHBOARD_DATA_TABLE_EXPLORER_PANEL_TYPE,
  MosaicDashboardEntry,
  MosaicDashboardPanelConfig,
} from '../dashboard/dashboard-types';
import type {DataTableExplorerPanelConfig} from '../dashboard/core-types';
import type {ChartConfig} from '../charts/chart-types/chart-config';
import {AiAgentError} from './errors';
import {BaseMosaicAiAdapter} from './types';
import {DashboardAiAdapter} from './dashboard/dashboard-types';
import {DataTable} from '@sqlrooms/duckdb';
import {Tool} from 'ai';

export interface PanelResult {
  panelId: string;
  title: string;
  config: ChartConfig | DataTableExplorerPanelConfig;
}

export interface CreateOrUpdateChartPanelParams {
  panelId?: string;
  tableName: string;
  title: string;
  config: ChartConfig;
}

export interface CreateOrUpdateDataTableExplorerPanelParams {
  panelId?: string;
  tableName: string;
  title: string;
  config: DataTableExplorerPanelConfig;
}

/**
 * Validates that a table exists. Throws if not found.
 */
export function ensureTable(
  adapter: BaseMosaicAiAdapter,
  tableName: string,
): DataTable {
  const table = adapter.findTable(tableName);

  if (!table) {
    throw new AiAgentError(`Table "${tableName}" not found.`);
  }

  return table;
}

/**
 * Validates that a dashboard exists. Throws if not found.
 */
export function ensureDashboard(
  adapter: DashboardAiAdapter,
  dashboardId: string,
): MosaicDashboardEntry {
  const dashboard = adapter.getDashboard(dashboardId);
  if (!dashboard) {
    throw new AiAgentError(
      `Dashboard "${dashboardId}" not found. Cannot update panel.`,
    );
  }
  return dashboard;
}

/**
 * Validates that a panel exists in a dashboard. Throws if not found.
 */
export function ensurePanel(
  adapter: DashboardAiAdapter,
  panelId: string,
  type?: string,
): MosaicDashboardPanelConfig {
  const panel = adapter.getPanel(panelId);

  if (!panel) {
    throw new AiAgentError(`Panel not found.`);
  }

  if (type !== undefined && panel.type !== type) {
    throw new AiAgentError(
      `Panel is of type "${panel.type}", expected type "${type}".`,
    );
  }

  return panel;
}

/**
 * Universal helper to create or update a dataTableExplorer panel.
 */
export function createOrUpdateDataTableExplorerPanel(
  {
    panelId,
    config,
    title,
    tableName,
  }: CreateOrUpdateDataTableExplorerPanelParams,
  adapter: DashboardAiAdapter,
): PanelResult {
  if (panelId) {
    ensurePanel(
      adapter,
      panelId,
      MOSAIC_DASHBOARD_DATA_TABLE_EXPLORER_PANEL_TYPE,
    );

    adapter.updatePanel(panelId, {
      config,
      title,
      source: {tableName},
    });

    return {
      panelId,
      title,
      config,
    };
  }

  // Create new panel - create full panel config
  const panel = createMosaicDashboardDataTableExplorerPanelConfig({
    title,
    config,
  });

  const newPanelId = adapter.addPanel(panel);

  return {
    panelId: newPanelId,
    title: panel.title,
    config: panel.config,
  };
}

export function ensureNoOverride(
  builtInTools: Record<string, Tool>,
  extraTools: Record<string, Tool>,
) {
  for (const key of Object.keys(extraTools)) {
    if (key in builtInTools) {
      throw new AiAgentError(
        `Dashboard extraTools cannot override built-in tool "${key}". Register the host tool under a unique key.`,
      );
    }
  }
}
