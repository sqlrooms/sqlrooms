import type {AiSliceState} from '@sqlrooms/ai-core';
import type {DuckDbSliceState} from '@sqlrooms/duckdb';
import type {BaseRoomStoreState, StoreApi} from '@sqlrooms/room-shell';
import {createQueryTool} from './query/queryTool';
import type {
  QueryToolOptions,
  QueryToolParameters,
  QueryToolOutput,
} from './query/queryTool';
import type {Tool, ToolSet} from 'ai';
import type {ToolRenderer} from '@sqlrooms/ai-core';
import {createCommandTools} from './commandTools';
import type {CommandToolsOptions, DefaultCommandTools} from './commandTools';
import {QueryToolResult} from './query/QueryToolResult';

export type DefaultToolsOptions = {
  query?: QueryToolOptions;
  commands?: CommandToolsOptions | false;
};

type QueryTool = Tool<QueryToolParameters, QueryToolOutput>;

/**
 * Default tools available to the AI assistant for data analysis.
 * Includes:
 * - query: Executes SQL queries against DuckDB
 * - list_commands / execute_command: Bridge to room command registry
 *
 * Pass `commands: false` to opt out of the command tools (e.g. in rooms
 * without a command registry).
 */
export function createDefaultAiTools(
  store: StoreApi<BaseRoomStoreState & AiSliceState & DuckDbSliceState>,
  options: DefaultToolsOptions & {commands: false},
): {query: QueryTool};
export function createDefaultAiTools(
  store: StoreApi<BaseRoomStoreState & AiSliceState & DuckDbSliceState>,
  options?: DefaultToolsOptions,
): {query: QueryTool} & DefaultCommandTools;
export function createDefaultAiTools(
  store: StoreApi<BaseRoomStoreState & AiSliceState & DuckDbSliceState>,
  options?: DefaultToolsOptions,
): ToolSet {
  const {query, commands} = options || {};
  const commandTools =
    commands === false
      ? {}
      : commands != null
        ? createCommandTools(store, commands)
        : createCommandTools(store);
  return {
    query: createQueryTool(store, query),
    ...commandTools,
  };
}

/** The typed shape returned by {@link createDefaultAiToolRenderers}. */
export type DefaultAiToolRenderers = {
  query: ToolRenderer<QueryToolOutput, QueryToolParameters>;
};

/**
 * Creates the default tool renderer registry for the built-in AI tools.
 * Returns a typed map so it contributes to the `toolRenderers` constraint
 * when spread alongside custom renderers in {@link createAiSlice}.
 */
export function createDefaultAiToolRenderers(): DefaultAiToolRenderers {
  return {
    query: QueryToolResult,
  };
}
