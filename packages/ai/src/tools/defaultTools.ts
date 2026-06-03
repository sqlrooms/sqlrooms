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
import {createTableSchemaTools} from './tableSchemaTools';
import type {DefaultTableSchemaTools} from './tableSchemaTools';

export type DefaultToolsOptions = {
  query?: QueryToolOptions;
  commands?: CommandToolsOptions | false;
  tables?: false;
};

type QueryTool = Tool<QueryToolParameters, QueryToolOutput>;
type QueryToolSet = {query: QueryTool};

/**
 * Default tools available to the AI assistant for data analysis.
 * Includes:
 * - query: Executes SQL queries against DuckDB
 * - list_tables / describe_table_schema: Discover available table metadata
 * - list_commands / execute_command: Bridge to room command registry
 *
 * Pass `commands: false` to opt out of the command tools (e.g. in rooms
 * without a command registry).
 * Pass `tables: false` to opt out of the table schema tools.
 */
export function createDefaultAiTools(
  store: StoreApi<BaseRoomStoreState & AiSliceState & DuckDbSliceState>,
  options: DefaultToolsOptions & {commands: false; tables: false},
): QueryToolSet;
export function createDefaultAiTools(
  store: StoreApi<BaseRoomStoreState & AiSliceState & DuckDbSliceState>,
  options: DefaultToolsOptions & {tables: false},
): QueryToolSet & DefaultCommandTools;
export function createDefaultAiTools(
  store: StoreApi<BaseRoomStoreState & AiSliceState & DuckDbSliceState>,
  options: DefaultToolsOptions & {commands: false},
): QueryToolSet & DefaultTableSchemaTools;
export function createDefaultAiTools(
  store: StoreApi<BaseRoomStoreState & AiSliceState & DuckDbSliceState>,
  options?: DefaultToolsOptions,
): QueryToolSet & DefaultTableSchemaTools & DefaultCommandTools;
export function createDefaultAiTools(
  store: StoreApi<BaseRoomStoreState & AiSliceState & DuckDbSliceState>,
  options?: DefaultToolsOptions,
): ToolSet {
  const {query, commands, tables} = options || {};
  const commandTools =
    commands === false
      ? {}
      : commands != null
        ? createCommandTools(store, commands)
        : createCommandTools(store);
  const tableSchemaTools =
    tables === false ? {} : createTableSchemaTools(store);
  return {
    query: createQueryTool(store, query),
    ...tableSchemaTools,
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
