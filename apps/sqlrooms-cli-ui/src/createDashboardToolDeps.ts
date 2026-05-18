import {
  type DashboardToolDeps,
  type ChartBuilderColumn,
  type ChartToolExecutionContext,
} from '@sqlrooms/mosaic';
import type {RoomState} from './store';
import {DataTable} from '@sqlrooms/db';
import {getAiRunContextItems} from '@sqlrooms/ai';

// Helper functions
function getTablesWithColumns(state: RoomState): DataTable[] {
  return state.db.tables.filter(
    (table) => table.columns && table.columns.length > 0,
  );
}

function findTableColumns(
  state: RoomState,
  tableName: string,
): ChartBuilderColumn[] | null {
  const table = getTablesWithColumns(state).find(
    (candidate) => candidate.tableName === tableName,
  );
  if (!table?.columns) return null;
  return table.columns.map((column) => ({
    name: column.name,
    type: column.type,
  }));
}

// Create dependencies for tool execution
export function createDashboardToolDeps(store: {
  getState: () => RoomState;
}): DashboardToolDeps {
  const getRunContextDashboardArtifactId = (
    state: RoomState,
    context?: ChartToolExecutionContext,
  ) => {
    const contextItems = getAiRunContextItems(context?.aiRunContext);
    return contextItems.find((item) => {
      const artifact = state.artifacts.config.artifactsById[item.id];
      return artifact?.type === 'dashboard';
    })?.id;
  };

  const resolveArtifact = (
    artifactId?: string,
    createIfMissing?: boolean,
    context?: ChartToolExecutionContext,
  ): string => {
    const state = store.getState();
    let targetArtifactId =
      artifactId ??
      getRunContextDashboardArtifactId(state, context) ??
      state.dashboard.getCurrentDashboardArtifactId();
    if (!targetArtifactId && createIfMissing) {
      targetArtifactId = state.dashboard.createDashboardArtifact(
        undefined,
        'grid',
      );
    }
    if (!targetArtifactId) {
      throw new Error(
        'No dashboard artifact is available. Set createArtifactIfMissing=true or create one first.',
      );
    }

    const artifact = state.artifacts.getArtifact(targetArtifactId);
    if (!artifact || artifact.type !== 'dashboard') {
      throw new Error(
        `Artifact "${targetArtifactId}" is not a dashboard artifact.`,
      );
    }

    state.dashboard.ensureDashboardArtifact(targetArtifactId);
    return targetArtifactId;
  };

  const resolveTable = (artifactId: string, tableName?: string) => {
    const state = store.getState();
    const tables = getTablesWithColumns(state);
    const dashboard = state.mosaicDashboard.getDashboard(artifactId);
    const explicitTableName = tableName?.trim() || undefined;

    if (explicitTableName) {
      const columns = findTableColumns(state, explicitTableName);
      if (!columns) {
        throw new Error(
          `Unknown table "${explicitTableName}". Available tables: ${tables.map((t) => t.tableName).join(', ') || '(none)'}.`,
        );
      }
      state.mosaicDashboard.setSelectedTable(artifactId, explicitTableName);
      return {tableName: explicitTableName, columns};
    }

    if (dashboard?.selectedTable) {
      const columns = findTableColumns(state, dashboard.selectedTable);
      if (columns) {
        return {tableName: dashboard.selectedTable, columns};
      }
    }

    if (tables.length === 1) {
      const onlyTable = tables[0];
      if (!onlyTable?.columns) {
        throw new Error('The only available table has no column metadata.');
      }
      state.mosaicDashboard.setSelectedTable(artifactId, onlyTable.tableName);
      return {
        tableName: onlyTable.tableName,
        columns: onlyTable.columns.map((column) => ({
          name: column.name,
          type: column.type,
        })),
      };
    }

    throw new Error(
      `No dashboard table is selected. Provide tableName using one of: ${tables.map((t) => t.tableName).join(', ') || '(none)'}.`,
    );
  };

  return {
    resolveResources: (params, context) => {
      const artifactId = resolveArtifact(
        params.artifactId,
        params.createArtifactIfMissing,
        context,
      );
      const {tableName, columns} = resolveTable(artifactId, params.tableName);
      return {artifactId, tableName, columns};
    },

    addPanel: (dashboardId: string, panel: any) => {
      const state = store.getState();
      return state.mosaicDashboard.addPanel(dashboardId, panel);
    },

    updatePanel: (
      dashboardId: string,
      panelId: string,
      patch: Partial<{title?: string; config?: any}>,
    ) => {
      const state = store.getState();
      state.mosaicDashboard.updatePanel(dashboardId, panelId, patch);
    },

    getDashboard: (dashboardId: string) => {
      const state = store.getState();
      return state.mosaicDashboard.getDashboard(dashboardId);
    },

    removePanel: (dashboardId: string, panelId: string) => {
      const state = store.getState();
      state.mosaicDashboard.removePanel(dashboardId, panelId);
    },

    setCurrentArtifact: (artifactId: string) => {
      const state = store.getState();
      state.artifacts.setCurrentArtifact(artifactId);
    },
  };
}
