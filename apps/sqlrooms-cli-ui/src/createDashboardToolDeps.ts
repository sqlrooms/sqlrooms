import {
  getAiRunContextItems,
  getAiRunContextPrimaryItem,
  type AiToolExecutionContext,
} from '@sqlrooms/ai';
import {
  type ChartToolExecutionContext,
  type DashboardAiAdapter,
  createDashboardToolDeps as createReusableDashboardToolDeps,
} from '@sqlrooms/mosaic/ai';
import type {StoreApi} from 'zustand';
import {makeArtifactPrimaryForAiRun} from './createArtifactContextAiTools';
import type {RoomState} from './store-types';

function getMutableAiRunContext(context?: ChartToolExecutionContext) {
  return (
    (
      context as
        | (ChartToolExecutionContext & {getAiRunContext?: () => unknown})
        | undefined
    )?.getAiRunContext?.() ?? context?.aiRunContext
  );
}

export function createDashboardAiAdapter(
  store: StoreApi<RoomState>,
): DashboardAiAdapter<RoomState> {
  return {
    getTables: (state) =>
      state.db.tables.map((table) => ({
        tableName: table.tableName,
        columns: table.columns?.map((column) => ({
          name: column.name,
          type: column.type,
        })),
        rowCount: table.rowCount,
      })),
    hasRunContext: (_state, context) =>
      getAiRunContextItems(getMutableAiRunContext(context)).length > 0,
    resolveContextDashboardArtifactId: (state, context) => {
      const primaryItem = getAiRunContextPrimaryItem(
        getMutableAiRunContext(context),
      );
      if (!primaryItem) return undefined;
      const artifact = state.artifacts.config.artifactsById[primaryItem.id];
      return artifact?.type === 'dashboard' ? primaryItem.id : undefined;
    },
    makeDashboardPrimaryForRun: (_state, dashboardId, context) =>
      makeArtifactPrimaryForAiRun(
        store,
        dashboardId,
        context as AiToolExecutionContext | undefined,
      ),
    getCurrentDashboardArtifactId: (state) =>
      state.dashboard.getCurrentDashboardArtifactId(),
    createDashboardArtifact: (state, title, layoutType) =>
      state.dashboard.createDashboardArtifact(title, layoutType),
    isDashboardArtifact: (state, artifactId) =>
      state.artifacts.getArtifact(artifactId)?.type === 'dashboard',
    setCurrentArtifact: (state, artifactId) =>
      state.artifacts.setCurrentArtifact(artifactId),
    ensureDashboard: (state, dashboardId) =>
      state.dashboard.ensureDashboardArtifact(dashboardId),
    getDashboard: (state, dashboardId) =>
      state.mosaicDashboard.getDashboard(dashboardId),
    setSelectedTable: (state, dashboardId, tableName) =>
      state.mosaicDashboard.setSelectedTable(dashboardId, tableName),
    addPanel: (state, dashboardId, panel) =>
      state.mosaicDashboard.addPanel(dashboardId, panel),
    updatePanel: (state, dashboardId, panelId, patch) =>
      state.mosaicDashboard.updatePanel(dashboardId, panelId, patch),
    removePanel: (state, dashboardId, panelId) =>
      state.mosaicDashboard.removePanel(dashboardId, panelId),
  };
}

export function createDashboardToolDeps(store: StoreApi<RoomState>) {
  return createReusableDashboardToolDeps({
    store,
    adapter: createDashboardAiAdapter(store),
  });
}
