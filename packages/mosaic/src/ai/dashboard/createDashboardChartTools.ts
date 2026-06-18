import type {Tool} from 'ai';
import {
  createChartTools,
  createDefaultChartTypes,
  ChartTypeDefinition,
  ChartToolDeps,
} from '../../charts/chart-types';

import {createMosaicDashboardChartPanelConfig} from '../../dashboard/MosaicDashboardSlice';
import {DashboardAiAdapter} from '../types';

export function createDashboardChartTools(
  adapter: DashboardAiAdapter,
  chartTypes?: ChartTypeDefinition<any>[],
): Record<string, Tool> {
  const resolvedChartTypes =
    chartTypes ?? createDefaultChartTypes({includeCustomSpec: false});

  const chartToolDeps: ChartToolDeps = {
    maxDataPoints: 10_000, // TODO: ???
    adapter,
    addChart: ({config, title}) =>
      adapter.addPanel(createMosaicDashboardChartPanelConfig(title, config)),
  };

  return createChartTools(
    resolvedChartTypes,
    chartToolDeps,
    'create_dashboard_panel_',
  );
}
