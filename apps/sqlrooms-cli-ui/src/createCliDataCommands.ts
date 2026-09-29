import {
  getTableIdentity,
  loadSchemaCatalog,
  type QualifiedTableName,
} from '@sqlrooms/duckdb';
import type {RoomCommand} from '@sqlrooms/room-shell';
import {z} from 'zod';
import {assertCliDestination, inspectCliSelect} from './cliSqlPolicy';
import type {RoomState} from './store-types';

/** Host adapter resolves a local file on the machine running DuckDB. */
export type CliLocalFileResolver = (
  input: {path: string; format?: 'csv' | 'parquet' | 'json'},
  signal?: AbortSignal,
) => Promise<{path: string; format: 'csv' | 'parquet' | 'json'}>;
/** CLI data commands share the database primitives used by the SQL editor. */
export const CLI_DATA_COMMAND_OWNER = 'sqlrooms-cli/data';
const destination = {
  tableName: z.string().min(1),
  replace: z.boolean().default(false),
};
const createInput = z
  .object({
    ...destination,
    query: z.string().min(1),
    view: z.boolean().default(false),
    temp: z.boolean().default(false),
  })
  .strict();
const importInput = z
  .object({
    ...destination,
    path: z
      .string()
      .min(1)
      .describe(
        'Local file path on the SQLRooms server; ~ is expanded there. Do not use file://.',
      ),
    format: z.enum(['csv', 'parquet', 'json']).optional(),
  })
  .strict();

/** Register materialized file imports and a non-replacing-by-default SQL command. */
export function createCliDataCommands(
  options: {
    metaNamespace?: string;
    resolveLocalFile?: CliLocalFileResolver;
  } = {},
): RoomCommand<RoomState>[] {
  const namespace = options.metaNamespace ?? '__sqlrooms';
  const metadata = {
    readOnly: false,
    idempotent: false,
    riskLevel: 'medium' as const,
    requiresConfirmation: true,
  };
  const describeTable = async (
    tableName: QualifiedTableName,
    state: RoomState,
    view = false,
  ) => {
    const resolved = state.db.qualifyTableName(tableName);
    const target = getTableIdentity(resolved);
    // Exact metadata lookup includes temporary tables and schemas hidden by the UI.
    const connector = await state.db.getConnector();
    const schemas = await loadSchemaCatalog(connector, {
      database: resolved.database,
      schema: resolved.schema,
      table: resolved.table,
      defaultDatabase: state.db.currentDatabase,
    });
    const table = schemas
      .flatMap((schema) => schema.tables)
      .find((entry) => getTableIdentity(entry.table) === target);
    if (!table)
      throw new Error(
        'The table was created but its schema could not be refreshed. Inspect the database before retrying.',
      );
    // WebSocket transports may discard CREATE TABLE's affected-row result.
    // Count the materialized relation instead of returning NaN/null as success.
    let count: number | undefined;
    if (!view) {
      const rows = await connector.query(
        `SELECT count(*) AS row_count FROM ${resolved.toFullString()}`,
      );
      count = Number(rows.getChild('row_count')?.get(0));
    }
    if (count !== undefined && !Number.isFinite(count))
      throw new Error(
        'The table was created but its row count could not be read. Inspect the database before retrying.',
      );
    return {tableId: target, columns: table.columns, rowCount: count};
  };
  return [
    {
      id: 'db.create-table-from-query',
      name: 'Create table from query',
      group: 'Database',
      description:
        'Materialize one SELECT as a table or view. Existing tables are preserved unless replace is explicitly true.',
      keywords: ['sql', 'create', 'table', 'view'],
      inputSchema: createInput,
      metadata,
      validateInput: async (raw, {getState}) => {
        const input = createInput.parse(raw);
        assertCliDestination(getState().db, input.tableName, namespace);
        await inspectCliSelect(getState().db, input.query, namespace);
      },
      execute: async ({getState, signal}, raw) => {
        const input = createInput.parse(raw);
        // Validate again at the execution boundary, including direct invocation.
        const target = assertCliDestination(
          getState().db,
          input.tableName,
          namespace,
        );
        await inspectCliSelect(getState().db, input.query, namespace);
        const result = await getState().db.createTableFromQuery(
          target,
          input.query,
          {
            replace: input.replace,
            view: input.view,
            temp: input.temp,
            allowMultipleStatements: false,
            abortSignal: signal,
          },
        );
        await getState().db.refreshTableSchemas();
        return {
          success: true,
          commandId: 'db.create-table-from-query',
          data: {
            ...result,
            ...(await describeTable(
              input.temp ? {...target, database: 'temp'} : target,
              getState(),
              input.view,
            )),
          },
        };
      },
    },
    {
      id: 'db.import-file',
      name: 'Import local file',
      group: 'Database',
      description:
        'Import a local CSV, Parquet, or JSON file into a persistent DuckDB table. Waits for completion and returns table identity, row count, and columns.',
      keywords: [
        'load',
        'data',
        'dataset',
        'csv',
        'parquet',
        'json',
        'file',
        'import',
      ],
      inputSchema: importInput,
      metadata,
      isEnabled: () => Boolean(options.resolveLocalFile),
      validateInput: (raw, {getState}) => {
        assertCliDestination(
          getState().db,
          importInput.parse(raw).tableName,
          namespace,
        );
      },
      execute: async ({getState, signal}, raw) => {
        const input = importInput.parse(raw);
        const target = assertCliDestination(
          getState().db,
          input.tableName,
          namespace,
        );
        if (!options.resolveLocalFile)
          throw new Error('This host does not support local file import.');
        const file = await options.resolveLocalFile(
          {path: input.path, format: input.format},
          signal,
        );
        if (signal?.aborted) throw new Error('Import cancelled.');
        // DuckDB interprets these characters as glob patterns, even for existing files.
        if (/[?*\[\]]/.test(file.path))
          throw new Error(
            'File paths containing glob characters (* ? [ ]) are not supported. Rename the file or its parent directory before importing.',
          );
        const reader = {
          csv: 'read_csv_auto',
          parquet: 'read_parquet',
          json: 'read_json_auto',
        }[file.format];
        const query = `SELECT * FROM ${reader}('${file.path.replace(/'/g, "''")}')`;
        const result = await getState().db.createTableFromQuery(target, query, {
          replace: input.replace,
          allowMultipleStatements: false,
          abortSignal: signal,
        });
        await getState().db.refreshTableSchemas();
        return {
          success: true,
          commandId: 'db.import-file',
          data: {
            ...result,
            sourcePath: file.path,
            ...(await describeTable(target, getState())),
          },
        };
      },
    },
  ];
}
