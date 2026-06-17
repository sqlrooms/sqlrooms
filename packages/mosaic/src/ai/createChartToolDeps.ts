import type {
  AddChartFunction,
  ChartToolDeps,
} from '../charts/chart-types/tool-types';
import {findTableByNameOrThrow} from '../utils/table-lookup';
import type {BaseAiAdapter} from './types';

export type CreateChartToolDepsOptions = {
  adapter: BaseAiAdapter;
  addChart: AddChartFunction;
};

/**
 * Creates ChartToolDeps from a BaseAiAdapter.
 * This is used to provide dependencies for chart configuration tools.
 *
 * @param adapter Adapter with getTables method
 * @returns ChartToolDeps with resolveTable and maxDataPoints
 */
export function createChartToolDeps({
  adapter,
  addChart,
}: CreateChartToolDepsOptions): ChartToolDeps {
  return {
    addChart,
    resolveTable: (tableName: string) => {
      const tables = adapter.getTables();
      return findTableByNameOrThrow(tables, tableName);
    },
    maxDataPoints: 10000, // Standard limit for non-aggregated visualizations
  };
}
