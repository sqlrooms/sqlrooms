import type {DataTable} from '@sqlrooms/db';
import type {
  ChartToolExecutionContext,
  DashboardToolDeps,
} from '../charts/chart-types';
import {findTableByNameOrThrow} from '../utils/table-lookup';
import type {DashboardAiAdapter, CreateDashboardToolDepsOptions} from './types';

function getTablesWithColumns<TState>(
  state: TState,
  adapter: DashboardAiAdapter<TState>,
): DataTable[] {
  return adapter
    .getTables(state)
    .filter((table) => table.columns && table.columns.length > 0);
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

  const resolveTable = (tableName: string) => {
    const state = store.getState();
    const tables = getTablesWithColumns(state, adapter);
    return findTableByNameOrThrow(tables, tableName);
  };

  const deps: DashboardToolDeps = {
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
