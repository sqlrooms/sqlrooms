import type {ChartToolDeps} from '../charts/chart-types/tool-types';
import {findTableByNameOrThrow} from '../utils/table-lookup';
import type {AiStore, BaseAiAdapter} from './types';

export type CreateChartToolDepsOptions<TState> = {
  store: AiStore<TState>;
  adapter: BaseAiAdapter<TState>;
};

/**
 * Creates ChartToolDeps from a BaseAiAdapter.
 * This is used to provide dependencies for chart configuration tools.
 *
 * @param adapter Adapter with getTables method
 * @param state Current state to pass to adapter
 * @returns ChartToolDeps with resolveTable and maxDataPoints
 */
export function createChartToolDeps<TState>({
  store,
  adapter,
}: CreateChartToolDepsOptions<TState>): ChartToolDeps {
  return {
    resolveTable: (tableName: string) => {
      const state = store.getState();
      const tables = adapter.getTables(state);
      return findTableByNameOrThrow(tables, tableName);
    },
    maxDataPoints: 10000, // Standard limit for non-aggregated visualizations
  };
}
