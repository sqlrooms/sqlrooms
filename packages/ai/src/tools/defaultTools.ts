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
import {createListTablesTool, createReadTableSchemaTool} from './tables';
import type {
  ListTablesParameters,
  ListTablesOutput,
  ReadTableSchemaParameters,
  ReadTableSchemaOutput,
} from './tables';

export type DefaultToolsOptions = {
  query?: QueryToolOptions;
  commands?: CommandToolsOptions | false;
  tables?: boolean;
};

type QueryTool = Tool<QueryToolParameters, QueryToolOutput>;
type ListTablesTool = Tool<ListTablesParameters, ListTablesOutput>;
type ReadTableSchemaTool = Tool<
  ReadTableSchemaParameters,
  ReadTableSchemaOutput
>;

export type DefaultTableTools = {
  list_tables: ListTablesTool;
  read_table_schema: ReadTableSchemaTool;
};

/**
 * Default tools available to the AI assistant for data analysis.
 * Includes:
 * - query: Executes SQL queries against DuckDB
 * - list_tables / read_table_schema: Discover and inspect database tables
 * - list_commands / execute_command: Bridge to room command registry
 *
 * Pass `commands: false` to opt out of the command tools (e.g. in rooms
 * without a command registry).
 * Pass `tables: false` to opt out of the table discovery tools.
 */
export function createDefaultAiTools(
  store: StoreApi<BaseRoomStoreState & AiSliceState & DuckDbSliceState>,
  options: DefaultToolsOptions & {commands: false; tables: false},
): {query: QueryTool};
export function createDefaultAiTools(
  store: StoreApi<BaseRoomStoreState & AiSliceState & DuckDbSliceState>,
  options: DefaultToolsOptions & {commands: false},
): {query: QueryTool} & DefaultTableTools;
export function createDefaultAiTools(
  store: StoreApi<BaseRoomStoreState & AiSliceState & DuckDbSliceState>,
  options: DefaultToolsOptions & {tables: false},
): {query: QueryTool} & DefaultCommandTools;
export function createDefaultAiTools(
  store: StoreApi<BaseRoomStoreState & AiSliceState & DuckDbSliceState>,
  options?: DefaultToolsOptions,
): {query: QueryTool} & DefaultCommandTools & DefaultTableTools;
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
  const tableTools =
    tables === false
      ? null
      : {
          list_tables: createListTablesTool(store),
          read_table_schema: createReadTableSchemaTool(store),
        };
  return {
    query: createQueryTool(store, query),
    ...commandTools,
    ...(tableTools ?? {}),
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
