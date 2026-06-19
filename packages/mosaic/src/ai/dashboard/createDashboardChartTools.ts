import type {Tool} from 'ai';
import {createChartTools, ChartToolParams} from '../../charts/chart-types';

import {createMosaicDashboardChartPanelConfig} from '../../dashboard/MosaicDashboardSlice';
import {DatabaseAiAdapter} from '../database-types';
import {DashboardAiAdapter} from './dashboard-types';
import {ChartToolsOptions} from '../types';
import {DEFAULT_CHART_MAX_DATA_POINTS} from '../../chart-runtime';
import {resolveChartTypes} from '../../charts/chart-types/resolveChartTypes';
import {DASHBOARD_CHART_TOOL_PREFIX} from './constants';

export type CreateDashboardChartToolsParams = {
  databaseAdapter: DatabaseAiAdapter;
  dashboardAdapter: DashboardAiAdapter;
  chartToolsOptions?: ChartToolsOptions;
};

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
    addChart: ({config, title}) =>
      dashboardAdapter.addPanel(
        createMosaicDashboardChartPanelConfig(title, config),
      ),
  };

  return createChartTools(
    resolvedChartTypes,
    chartToolParams,
    DASHBOARD_CHART_TOOL_PREFIX,
  );
}
