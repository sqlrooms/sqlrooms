import type {AiSliceState} from '@sqlrooms/ai-core';
import type {DuckDbSliceState} from '@sqlrooms/duckdb';
import type {BaseRoomStoreState, StoreApi} from '@sqlrooms/room-shell';
import {createQueryTool} from './query/queryTool';
import type {QueryToolOptions} from './query/queryTool';
import type {ToolSet} from 'ai';
import type {ToolRendererRegistry} from '@sqlrooms/ai-core';
import {createCommandTools} from './commandTools';
import type {CommandToolsOptions} from './commandTools';
import {QueryToolResult} from './query/QueryToolResult';

export type DefaultToolsOptions = {
  query?: QueryToolOptions;
  commands?: CommandToolsOptions | false;
};

/**
 * Default tools available to the AI assistant for data analysis
 * Includes:
 * - query: Executes SQL queries against DuckDB
 * - list_commands / execute_command: Bridge to room command registry
 */
export function createDefaultAiTools(
  store: StoreApi<BaseRoomStoreState & AiSliceState & DuckDbSliceState>,
  options?: DefaultToolsOptions,
): ToolSet {
  const {query, commands} = options || {};
  const commandTools =
    commands === false ? {} : createCommandTools(store, commands || undefined);
  return {
    query: createQueryTool(store, query),
    ...commandTools,
  };
}

/**
 * Creates the default tool renderer registry for the built-in AI tools.
 */
export function createDefaultAiToolRenderers(): ToolRendererRegistry {
  return {
    query: QueryToolResult,
  };
}
