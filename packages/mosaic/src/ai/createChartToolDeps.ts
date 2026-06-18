import type {
  AddChartFunction,
  ChartToolDeps,
} from '../charts/chart-types/tool-types';
import type {BaseMosaicAiAdapter} from './types';

export type CreateChartToolDepsOptions = {
  adapter: BaseMosaicAiAdapter;
  addChart: AddChartFunction;
};

/**
 * Creates ChartToolDeps from a BaseAiAdapter.
 * This is used to provide dependencies for chart configuration tools.
 *
 * @param adapter Adapter with getTables method
 * @returns ChartToolDeps with adapter and maxDataPoints
 */
export function createChartToolDeps({
  adapter,
  addChart,
}: CreateChartToolDepsOptions): ChartToolDeps {
  return {
    addChart,
    adapter,
    maxDataPoints: 10000, // Standard limit for non-aggregated visualizations
  };
}
