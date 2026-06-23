import type {Tool} from 'ai';
import {createChartTools, ChartToolParams} from '../../charts/chart-types';

import {createMosaicDashboardChartPanelConfig} from '../../dashboard/MosaicDashboardSlice';
import {DatabaseAiAdapter} from '../database-types';
import {DashboardAiAdapter} from './dashboard-types';
import {ChartToolsOptions} from '../types';
import {DEFAULT_CHART_MAX_DATA_POINTS} from '../../chart-runtime';
import {resolveChartTypes} from '../../charts/chart-types/resolveChartTypes';
import {DASHBOARD_CHART_TOOL_PREFIX} from './constants';
import {MOSAIC_DASHBOARD_CHART_PANEL_TYPE} from '../../dashboard/dashboard-types';

/**
 * Parameters for creating dashboard chart tools.
 *
 * @property databaseAdapter - Adapter for database operations and table queries
 * @property dashboardAdapter - Adapter for adding panels to the dashboard
 * @property chartToolsOptions - Optional configuration for chart types and data point limits
 */
export type CreateDashboardChartToolsParams = {
  databaseAdapter: DatabaseAiAdapter;
  dashboardAdapter: DashboardAiAdapter;
  chartToolsOptions?: ChartToolsOptions;
};

/**
 * Creates AI tools for generating chart panels in dashboards.
 *
 * @param params - Configuration parameters for chart tool creation
 * @param params.databaseAdapter - Adapter for database operations
 * @param params.dashboardAdapter - Adapter for dashboard panel management
 * @param params.chartToolsOptions - Optional chart configuration options
 * @returns Record of chart tool names to Tool instances, prefixed with dashboard-specific identifiers
 */
export function createDashboardChartTools({
  databaseAdapter,
  dashboardAdapter,
  chartToolsOptions,
}: CreateDashboardChartToolsParams): Record<string, Tool> {
  const resolvedChartTypes = resolveChartTypes(chartToolsOptions?.chartTypes);

  const chartToolParams: ChartToolParams = {
    maxDataPoints:
      chartToolsOptions?.chartMaxDataPoints ?? DEFAULT_CHART_MAX_DATA_POINTS,
    databaseAdapter,
    addChart: async ({config, tableName, title, panelId}) => {
      if (panelId) {
        const panel = dashboardAdapter.getPanel(panelId);
        if (!panel) {
          throw new Error(`Panel "${panelId}" not found.`);
        }
        if (panel.type !== MOSAIC_DASHBOARD_CHART_PANEL_TYPE) {
          throw new Error(
            `Panel "${panelId}" is not a chart panel. Cannot update it with a chart tool.`,
          );
        }

        if (tableName) {
          await dashboardAdapter.setSelectedTable(tableName);
        }
        await dashboardAdapter.updatePanel(panelId, {
          title: title ?? panel.title,
          config,
        });
        return panelId;
      }

      return await dashboardAdapter.addPanel(
        createMosaicDashboardChartPanelConfig(title ?? 'Chart', config),
      );
    },
  };

  return createChartTools(
    resolvedChartTypes,
    chartToolParams,
    DASHBOARD_CHART_TOOL_PREFIX,
  );
}
