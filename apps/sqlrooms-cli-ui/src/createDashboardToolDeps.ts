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
import {makeArtifactPrimaryForAiRun} from './context/createArtifactContextAiTools';
import type {RoomState} from './store-types';
import {DashboardToolDeps} from '@sqlrooms/mosaic';

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
): DashboardAiAdapter {
  return {
    getTables: () => store.getState().db.tables,
    hasRunContext: (context) =>
      getAiRunContextItems(getMutableAiRunContext(context)).length > 0,
    resolveContextDashboardArtifactId: (context) => {
      const primaryItem = getAiRunContextPrimaryItem(
        getMutableAiRunContext(context),
      );
      if (!primaryItem) return undefined;
      const artifact =
        store.getState().artifacts.config.artifactsById[primaryItem.id];
      return artifact?.type === 'dashboard' ? primaryItem.id : undefined;
    },
    makeDashboardPrimaryForRun: (dashboardId, context) =>
      makeArtifactPrimaryForAiRun(
        store,
        dashboardId,
        context as AiToolExecutionContext | undefined,
      ),
    getCurrentDashboardArtifactId: () =>
      store.getState().dashboard.getCurrentDashboardArtifactId(),
    createDashboardArtifact: (title, layoutType) =>
      store.getState().dashboard.createDashboardArtifact(title, layoutType),
    isDashboardArtifact: (artifactId) =>
      store.getState().artifacts.getArtifact(artifactId)?.type === 'dashboard',
    setCurrentArtifact: (artifactId) =>
      store.getState().artifacts.setCurrentArtifact(artifactId),
    ensureDashboard: (dashboardId) =>
      store.getState().dashboard.ensureDashboardArtifact(dashboardId),
    getDashboard: (dashboardId) =>
      store.getState().mosaicDashboard.getDashboard(dashboardId),
    setSelectedTable: (dashboardId, tableName) =>
      store.getState().mosaicDashboard.setSelectedTable(dashboardId, tableName),
    addPanel: (dashboardId, panel) =>
      store.getState().mosaicDashboard.addPanel(dashboardId, panel),
    updatePanel: (dashboardId, panelId, patch) =>
      store.getState().mosaicDashboard.updatePanel(dashboardId, panelId, patch),
    removePanel: (dashboardId, panelId) =>
      store.getState().mosaicDashboard.removePanel(dashboardId, panelId),
  };
}

export function createDashboardToolDeps(
  store: StoreApi<RoomState>,
): DashboardToolDeps {
  const adapter = createDashboardAiAdapter(store);

  return createReusableDashboardToolDeps(adapter);
}
