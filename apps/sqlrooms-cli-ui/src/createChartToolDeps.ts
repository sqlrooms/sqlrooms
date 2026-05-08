import {
  createMosaicDashboardVgPlotPanelConfig,
  createDefaultChartTypes,
  validateFieldValue,
  type ChartToolDeps,
  type ChartBuilderColumn,
} from '@sqlrooms/mosaic';
import type {RoomState} from './store';
import {DataTable} from '@sqlrooms/db';

const aiChartTypes = createDefaultChartTypes({includeCustomSpec: false});

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
export function createChartToolDeps(store: {
  getState: () => RoomState;
}): ChartToolDeps {
  const resolveArtifact = (
    artifactId?: string,
    createIfMissing?: boolean,
  ): string => {
    const state = store.getState();
    let targetArtifactId =
      artifactId ?? state.dashboard.getCurrentDashboardArtifactId();
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
    validateField: (fieldKey, value, field, columns) => {
      validateFieldValue(fieldKey, value, field, columns);
    },

    resolveResources: (params) => {
      const artifactId = resolveArtifact(
        params.artifactId,
        params.createArtifactIfMissing,
      );
      const {tableName, columns} = resolveTable(artifactId, params.tableName);
      return {artifactId, tableName, columns};
    },

    createChart: ({artifactId, tableName, title, config}) => {
      const state = store.getState();
      const chartTypeDef = aiChartTypes.find(
        (ct) => ct.id === config.chartType,
      );
      if (!chartTypeDef) {
        throw new Error(`Unknown chart type "${config.chartType}".`);
      }

      const panel = createMosaicDashboardVgPlotPanelConfig(title, config, {
        tableName,
      });

      state.mosaicDashboard.addPanel(artifactId, panel);
      state.artifacts.setCurrentArtifact(artifactId);

      return {
        panelId: panel.id,
        config,
        artifactId,
        tableName,
        title,
      };
    },
  };
}
