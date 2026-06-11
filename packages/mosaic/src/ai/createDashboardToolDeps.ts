import type {DataTable} from '@sqlrooms/db';
import type {
  ChartToolExecutionContext,
  DashboardToolDeps,
} from '../charts/chart-types';
import {DEFAULT_CHART_MAX_DATA_POINTS} from '../chart-runtime';
import {findTableByName} from '../utils/table-lookup';
import type {DashboardAiAdapter, CreateDashboardToolDepsOptions} from './types';

function getTablesWithColumns<TState>(
  state: TState,
  adapter: DashboardAiAdapter<TState>,
): DataTable[] {
  return adapter
    .getTables(state)
    .filter((table) => table.columns && table.columns.length > 0);
}

function formatAvailableTables(tables: DataTable[]): string {
  return tables.map((table) => table.table.table).join(', ') || '(none)';
}

export function createDashboardToolDeps<TState>({
  store,
  adapter,
}: CreateDashboardToolDepsOptions<TState>): DashboardToolDeps {
  const resolveArtifact = (
    artifactId?: string,
    createIfMissing?: boolean,
    context?: ChartToolExecutionContext,
  ): string => {
    const state = store.getState();
    const hasRunContext = adapter.hasRunContext?.(state, context) ?? false;
    const contextDashboardArtifactId =
      adapter.resolveContextDashboardArtifactId?.(state, context);
    let targetArtifactId =
      artifactId ??
      contextDashboardArtifactId ??
      (!hasRunContext
        ? adapter.getCurrentDashboardArtifactId(state)
        : undefined);

    if (!targetArtifactId && hasRunContext) {
      throw new Error(
        'No primary dashboard artifact is available in the current run context. Pass artifactId explicitly or use set_primary_context_artifact first.',
      );
    }

    if (!targetArtifactId && createIfMissing) {
      targetArtifactId = adapter.createDashboardArtifact(
        state,
        undefined,
        'grid',
      );
      adapter.setCurrentArtifact(state, targetArtifactId);
      adapter.makeDashboardPrimaryForRun?.(state, targetArtifactId, context);
    }

    if (!targetArtifactId) {
      throw new Error(
        'No dashboard artifact is available. Set createArtifactIfMissing=true or create one first.',
      );
    }

    if (!adapter.isDashboardArtifact(state, targetArtifactId)) {
      throw new Error(
        `Artifact "${targetArtifactId}" is not a dashboard artifact.`,
      );
    }

    adapter.ensureDashboard(state, targetArtifactId);
    return targetArtifactId;
  };

  const resolveTable = (artifactId: string, tableName?: string) => {
    const state = store.getState();
    const tables = getTablesWithColumns(state, adapter);
    const dashboard = adapter.getDashboard(state, artifactId);
    const explicitTableName = tableName?.trim() || undefined;

    if (explicitTableName) {
      const table = findTableByName(tables, explicitTableName);
      if (!table) {
        throw new Error(
          `Unknown table "${explicitTableName}". Available tables: ${formatAvailableTables(tables)}.`,
        );
      }
      adapter.setSelectedTable(state, artifactId, explicitTableName);
      return table;
    }

    if (dashboard?.selectedTable) {
      const table = findTableByName(tables, dashboard.selectedTable);
      if (table) {
        return table;
      }
    }

    if (tables.length === 1) {
      const onlyTable = tables[0];
      if (!onlyTable?.columns) {
        throw new Error('The only available table has no column metadata.');
      }
      adapter.setSelectedTable(state, artifactId, onlyTable.table.table);
      return onlyTable;
    }

    throw new Error(
      `No dashboard table is selected. Provide tableName using one of: ${formatAvailableTables(tables)}.`,
    );
  };

  const deps: DashboardToolDeps = {
    maxDataPoints: DEFAULT_CHART_MAX_DATA_POINTS,
    resolveArtifact,
    resolveTable,
    addPanel: (dashboardId, panel) => {
      const state = store.getState();
      return adapter.addPanel(state, dashboardId, panel);
    },
    updatePanel: (dashboardId, panelId, patch) => {
      const state = store.getState();
      adapter.updatePanel(state, dashboardId, panelId, patch);
    },
    getDashboard: (dashboardId) => {
      const state = store.getState();
      return adapter.getDashboard(state, dashboardId);
    },
    removePanel: (dashboardId, panelId) => {
      const state = store.getState();
      adapter.removePanel(state, dashboardId, panelId);
    },
    setCurrentArtifact: (artifactId) => {
      const state = store.getState();
      adapter.setCurrentArtifact(state, artifactId);
    },
  };

  if (adapter.getPanelIssue) {
    deps.getPanelIssue = (dashboardId, panelId) => {
      const state = store.getState();
      return adapter.getPanelIssue?.(state, dashboardId, panelId);
    };
  }

  return deps;
}
