import type {DashboardToolDeps} from '../charts/chart-types/base-types';
import {
  createMosaicDashboardChartPanelConfig,
  createMosaicDashboardDataTableExplorerPanelConfig,
} from '../dashboard/MosaicDashboardSlice';
import {MosaicDashboardEntry} from '../dashboard/dashboard-types';
import type {DataTableExplorerPanelConfig} from '../dashboard/core-types';
import type {ChartConfig} from '../charts/chart-types/chart-config';

export interface PanelResult {
  panelId: string;
  artifactId: string;
  title: string;
  config: ChartConfig | DataTableExplorerPanelConfig;
}

export interface CreateOrUpdateChartPanelParams {
  panelId?: string;
  dashboardId: string;
  tableName: string;
  title: string;
  config: ChartConfig;
}

export interface CreateOrUpdateDataTableExplorerPanelParams {
  panelId?: string;
  dashboardId: string;
  tableName: string;
  title: string;
  config: DataTableExplorerPanelConfig;
}

/**
 * Validates that a dashboard exists. Throws if not found.
 */
function ensureDashboard(
  deps: DashboardToolDeps,
  dashboardId: string,
): NonNullable<ReturnType<DashboardToolDeps['getDashboard']>> {
  const dashboard = deps.getDashboard(dashboardId);
  if (!dashboard) {
    throw new Error(
      `Dashboard "${dashboardId}" not found. Cannot update panel.`,
    );
  }
  return dashboard;
}

/**
 * Validates that a panel exists in a dashboard. Throws if not found.
 */
function ensurePanel(
  dashboard: MosaicDashboardEntry,
  dashboardId: string,
  panelId: string,
): void {
  const panelExists = dashboard.panels.some((p) => p.id === panelId);
  if (!panelExists) {
    throw new Error(
      `Panel "${panelId}" not found in dashboard "${dashboardId}". Cannot update.`,
    );
  }
}

/**
 * Universal helper to create or update a chart panel.
 * Handles everything: panel config creation, add/update logic, artifact switching.
 * When updating, both source and config are updated to allow changing the data source.
 */
export function createOrUpdateChartPanel(
  deps: DashboardToolDeps,
  params: CreateOrUpdateChartPanelParams,
): PanelResult {
  if (params.panelId) {
    // Validate panel exists before attempting update
    const dashboard = ensureDashboard(deps, params.dashboardId);
    ensurePanel(dashboard, params.dashboardId, params.panelId);

    // Update existing panel - update both source and config
    deps.updatePanel(params.dashboardId, params.panelId, {
      title: params.title,
      source: {tableName: params.tableName},
      config: params.config,
    });

    return {
      panelId: params.panelId,
      artifactId: params.dashboardId,
      title: params.title,
      config: params.config,
    };
  } else {
    // Create new panel - create config and add to dashboard
    const panel = createMosaicDashboardChartPanelConfig(
      params.title,
      params.config,
    );

    const panelId = deps.addPanel(params.dashboardId, panel);
    deps.setCurrentArtifact(params.dashboardId);

    return {
      panelId,
      artifactId: params.dashboardId,
      title: params.title,
      config: params.config,
    };
  }
}

/**
 * Universal helper to create or update a dataTableExplorer panel.
 */
export function createOrUpdateDataTableExplorerPanel(
  deps: DashboardToolDeps,
  params: CreateOrUpdateDataTableExplorerPanelParams,
): PanelResult {
  if (params.panelId) {
    // Validate panel exists before attempting update
    const dashboard = ensureDashboard(deps, params.dashboardId);
    ensurePanel(dashboard, params.dashboardId, params.panelId);

    deps.updatePanel(params.dashboardId, params.panelId, {
      config: params.config,
      source: {tableName: params.tableName},
      title: params.title,
    });

    return {
      panelId: params.panelId,
      artifactId: params.dashboardId,
      title: params.title,
      config: params.config,
    };
  } else {
    // Create new panel - create full panel config
    const panel = createMosaicDashboardDataTableExplorerPanelConfig({
      title: params.title,
      config: params.config,
    });

    const panelId = deps.addPanel(params.dashboardId, panel);
    deps.setCurrentArtifact(params.dashboardId);

    return {
      panelId,
      artifactId: params.dashboardId,
      title: panel.title,
      config: panel.config,
    };
  }
}
