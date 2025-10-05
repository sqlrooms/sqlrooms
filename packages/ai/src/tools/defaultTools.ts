import {AiSliceState, AiSliceTool} from '@sqlrooms/ai-core';
import {DuckDbSliceState} from '@sqlrooms/duckdb';
import {StoreApi} from '@sqlrooms/room-shell';
import {createQueryTool, QueryToolOptions} from './query/queryTool';

export type DefaultToolsOptions = {
  query?: QueryToolOptions;
};

/**
 * Default tools available to the AI assistant for data analysis
 * Includes:
 * - query: Executes SQL queries against DuckDB
 */
export function createDefaultAiTools(
  store: StoreApi<AiSliceState & DuckDbSliceState>,
  options?: DefaultToolsOptions,
): Record<string, AiSliceTool> {
  const {query} = options || {};
  return {
    query: createQueryTool(store, query),
  };
}
