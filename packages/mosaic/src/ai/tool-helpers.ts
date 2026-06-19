import {
  MosaicDashboardEntry,
  MosaicDashboardPanelConfig,
} from '../dashboard/dashboard-types';
import {AiAgentError} from './errors';
import {DashboardAiAdapter} from './dashboard/dashboard-types';
import {DataTable} from '@sqlrooms/duckdb';
import {Tool} from 'ai';
import {DatabaseAiAdapter} from './database-types';

/**
 * Validates that a table exists. Throws if not found.
 */
export function ensureTable(
  adapter: DatabaseAiAdapter,
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
  const dashboard = adapter.getDashboard();
  if (!dashboard) {
    throw new AiAgentError(`Dashboard "${dashboardId}" not found.`);
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
