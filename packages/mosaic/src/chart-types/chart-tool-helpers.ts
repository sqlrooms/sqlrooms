import type {DashboardToolDeps} from './base-types';
import {
  createMosaicDashboardChartPanelConfig,
  createMosaicDashboardProfilerPanelConfig,
  createMosaicDashboardTextPanelConfig,
} from '../dashboard/MosaicDashboardSlice';

export interface PanelResult {
  panelId: string;
  artifactId: string;
  title: string;
  config: any;
}

export interface CreateOrUpdateChartPanelParams {
  panelId?: string;
  dashboardId: string;
  tableName: string;
  title: string;
  config: any;
}

export interface CreateOrUpdateProfilerPanelParams {
  panelId?: string;
  dashboardId: string;
  tableName: string;
  title: string;
  pageSize?: number;
}

export interface CreateOrUpdateTextPanelParams {
  panelId?: string;
  dashboardId: string;
  title: string;
  content: string;
}

/**
 * Universal helper to create or update a chart panel.
 * Handles everything: panel config creation, add/update logic, artifact switching.
 */
export function createOrUpdateChartPanel(
  deps: DashboardToolDeps,
  params: CreateOrUpdateChartPanelParams,
): PanelResult {
  if (params.panelId) {
    // Update existing panel
    deps.updatePanel(params.dashboardId, params.panelId, {
      title: params.title,
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
      {tableName: params.tableName},
    );

    const panelId = deps.addPanel(params.dashboardId, panel);

    return {
      panelId,
      artifactId: params.dashboardId,
      title: params.title,
      config: params.config,
    };
  }
}

/**
 * Universal helper to create or update a profiler panel.
 */
export function createOrUpdateProfilerPanel(
  deps: DashboardToolDeps,
  params: CreateOrUpdateProfilerPanelParams,
): PanelResult {
  if (params.panelId) {
    // Update existing panel - create config inline with just what we need
    deps.updatePanel(params.dashboardId, params.panelId, {
      title: params.title,
      config: {
        source: {tableName: params.tableName},
        pageSize: params.pageSize,
      },
    });

    return {
      panelId: params.panelId,
      artifactId: params.dashboardId,
      title: params.title,
      config: {
        source: {tableName: params.tableName},
        pageSize: params.pageSize,
      },
    };
  } else {
    // Create new panel - create full panel config
    const panel = createMosaicDashboardProfilerPanelConfig({
      title: params.title,
      source: {tableName: params.tableName},
      pageSize: params.pageSize,
    });

    const panelId = deps.addPanel(params.dashboardId, panel);

    return {
      panelId,
      artifactId: params.dashboardId,
      title: panel.title,
      config: panel.config,
    };
  }
}

/**
 * Universal helper to create or update a text panel.
 */
export function createOrUpdateTextPanel(
  deps: DashboardToolDeps,
  params: CreateOrUpdateTextPanelParams,
): PanelResult {
  if (params.panelId) {
    // Update existing panel - create config inline with just what we need
    deps.updatePanel(params.dashboardId, params.panelId, {
      title: params.title,
      config: {
        content: params.content,
      },
    });

    return {
      panelId: params.panelId,
      artifactId: params.dashboardId,
      title: params.title,
      config: {
        content: params.content,
      },
    };
  } else {
    // Create new panel - create full panel config
    const panel = createMosaicDashboardTextPanelConfig({
      title: params.title,
      content: params.content,
    });

    const panelId = deps.addPanel(params.dashboardId, panel);

    return {
      panelId,
      artifactId: params.dashboardId,
      title: panel.title,
      config: panel.config,
    };
  }
}
