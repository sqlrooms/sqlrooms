import type {AiSliceState} from '@sqlrooms/ai-core';
import type {DuckDbSliceState} from '@sqlrooms/duckdb';
import type {BaseRoomStoreState, StoreApi} from '@sqlrooms/room-shell';
import {createQueryTool} from './query/queryTool';
import type {QueryToolOptions} from './query/queryTool';
import {OpenAssistantToolSet} from '@openassistant/utils';
import {createCommandTools} from './commandTools';
import type {CommandToolsOptions} from './commandTools';

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
): OpenAssistantToolSet {
  const {query, commands} = options || {};
  const commandTools =
    commands === false ? {} : createCommandTools(store, commands || undefined);
  return {
    query: createQueryTool(store, query),
    ...commandTools,
  };
}
