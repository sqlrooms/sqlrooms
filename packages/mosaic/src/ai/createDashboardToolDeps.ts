import type {DataTable} from '@sqlrooms/db';
import type {
  ChartToolExecutionContext,
  DashboardToolDeps,
} from '../charts/chart-types';
import {findTableByNameOrThrow} from '../utils/table-lookup';
import type {DashboardAiAdapter} from './types';

function getTablesWithColumns(adapter: DashboardAiAdapter): DataTable[] {
  return adapter
    .getTables()
    .filter((table) => table.columns && table.columns.length > 0);
}

export function createDashboardToolDeps(
  adapter: DashboardAiAdapter,
): DashboardToolDeps {
  const resolveArtifact = (
    artifactId?: string,
    createIfMissing?: boolean,
    context?: ChartToolExecutionContext,
  ): string => {
    const hasRunContext = adapter.hasRunContext?.(context) ?? false;
    const contextDashboardArtifactId =
      adapter.resolveContextDashboardArtifactId?.(context);
    let targetArtifactId =
      artifactId ??
      contextDashboardArtifactId ??
      (!hasRunContext ? adapter.getCurrentDashboardArtifactId() : undefined);

    if (!targetArtifactId && hasRunContext) {
      throw new Error(
        'No primary dashboard artifact is available in the current run context. Pass artifactId explicitly or use set_primary_context_artifact first.',
      );
    }

    if (!targetArtifactId && createIfMissing) {
      targetArtifactId = adapter.createDashboardArtifact(undefined, 'grid');
      adapter.setCurrentArtifact(targetArtifactId);
      adapter.makeDashboardPrimaryForRun?.(targetArtifactId, context);
    }

    if (!targetArtifactId) {
      throw new Error(
        'No dashboard artifact is available. Set createArtifactIfMissing=true or create one first.',
      );
    }

    if (!adapter.isDashboardArtifact(targetArtifactId)) {
      throw new Error(
        `Artifact "${targetArtifactId}" is not a dashboard artifact.`,
      );
    }

    adapter.ensureDashboard(targetArtifactId);
    return targetArtifactId;
  };

  const resolveTable = (tableName: string) => {
    const tables = getTablesWithColumns(adapter);
    return findTableByNameOrThrow(tables, tableName);
  };

  const deps: DashboardToolDeps = {
    resolveArtifact,
    resolveTable,
    addPanel: (dashboardId, panel) => {
      return adapter.addPanel(dashboardId, panel);
    },
    updatePanel: (dashboardId, panelId, patch) => {
      adapter.updatePanel(dashboardId, panelId, patch);
    },
    getDashboard: (dashboardId) => {
      return adapter.getDashboard(dashboardId);
    },
    removePanel: (dashboardId, panelId) => {
      adapter.removePanel(dashboardId, panelId);
    },
    setCurrentArtifact: (artifactId) => {
      adapter.setCurrentArtifact(artifactId);
    },
  };

  if (adapter.getPanelIssue) {
    deps.getPanelIssue = (dashboardId, panelId) => {
      return adapter.getPanelIssue?.(dashboardId, panelId);
    };
  }

  return deps;
}
