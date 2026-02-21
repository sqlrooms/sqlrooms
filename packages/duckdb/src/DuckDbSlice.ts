import {
  createDbSchemaTrees,
  DataTable,
  DbSchemaNode,
  DuckDbConnector,
  escapeVal,
  getColValAsNumber,
  isQualifiedTableName,
  joinStatements,
  makeQualifiedTableName,
  QualifiedTableName,
  QueryHandle,
  separateLastStatement,
  TableColumn,
} from '@sqlrooms/duckdb-core';
import {
  BaseRoomStoreState,
  createSlice,
  useBaseRoomStore,
} from '@sqlrooms/room-store';
import * as arrow from 'apache-arrow';
import deepEquals from 'fast-deep-equal';
import {produce} from 'immer';
import {StateCreator} from 'zustand';
import {createWasmDuckDbConnector} from './connectors/createDuckDbConnector';

function isDuckDbPlaceholderViewColumn(
  columnName: string,
  columnType: string,
): boolean {
  return columnName === '__' && columnType.toUpperCase() === 'UNKNOWN';
}

export type SchemaAndDatabase = {
  schema?: string;
  database?: string;
};

/**
 * State and actions for the DuckDB slice
 */
export type DuckDbSliceState = {
  db: {
    /**
     * The DuckDB connector instance
     */
    connector: DuckDbConnector;
    /**
     * @deprecated We shouldn't limit the schema to a single one.
     */
    schema: string;

    currentSchema: string | undefined;
    currentDatabase: string | undefined;

    /**
     * Cache of refreshed table schemas
     */
    tables: DataTable[];
    /**
     * Cache of row counts for tables
     */
    tableRowCounts: {[tableName: string]: number};
    /**
     * Cache of schema trees for tables
     */
    schemaTrees?: DbSchemaNode[];
    /**
     * Cache of currently running query handles.
     * This is only used for running queries to deduplicate them (especially for useSql),
     * the cache is cleared when the query is completed.
     */
    queryCache: {[key: string]: QueryHandle};
    /**
     * Whether the table schemas are being refreshed
     */
    isRefreshingTableSchemas: boolean;

    /**
     * Set a new DuckDB connector
     */
    setConnector: (connector: DuckDbConnector) => void;

    /**
     * Initialize the connector (creates a WasmDuckDbConnector if none exists)
     */
    initialize: () => Promise<void>;

    /**
     * Close and clean up the connector
     */
    destroy: () => Promise<void>;

    /**
     * Add a table to the room.
     * @param tableName - The name of the table to add.
     * @param data - The data to add to the table: an arrow table or an array of records.
     * @returns A promise that resolves to the table that was added.
     */
    addTable(
      tableName: string | QualifiedTableName,
      data: arrow.Table | Record<string, unknown>[],
    ): Promise<DataTable>;

    /**
     * Load the schemas of the tables in the database.
     */
    loadTableSchemas(
      filter?: SchemaAndDatabase & {table?: string},
    ): Promise<DataTable[]>;

    /**
     * @deprecated Use findTableByName instead
     */
    getTable(tableName: string): DataTable | undefined;

    /**
     * @internal Avoid using this directly, it's for internal use.
     */
    setTableRowCount(
      tableName: string | QualifiedTableName,
      rowCount: number,
    ): void;

    /**
     * Find a table by name in the last refreshed table schemas.
     * If no schema or database is provided, the table will be found in the current schema
     * and database (from last table schemas refresh).
     * @param tableName - The name of the table to find or a qualified table name.
     * @returns The table or undefined if not found.
     */
    findTableByName(
      tableName: string | QualifiedTableName,
    ): DataTable | undefined;

    /**
     * Refresh table schemas from the database.
     * @returns A promise that resolves to the updated tables.
     */
    refreshTableSchemas(): Promise<DataTable[]>;
    /**
     * Get the connector. If it's not initialized, it will be initialized.
     */
    getConnector: () => Promise<DuckDbConnector>;

    /**
     * @deprecated Use .loadTableRowCount() instead
     */
    getTableRowCount: (table: string, schema?: string) => Promise<number>;

    /**
     * Load the row count of a table
     */
    loadTableRowCount: (
      tableName: string | QualifiedTableName,
    ) => Promise<number>;

    /**
     * Execute a query with query handle (not result) caching and deduplication
     * @param query - The SQL query to execute
     * @returns The QueryHandle for the query or null if disabled
     */
    executeSql: (
      query: string,
      version?: number,
    ) => Promise<QueryHandle | null>;

    /**
     * @deprecated Use .tables or .loadTableSchemas() instead
     */
    getTables: (schema?: string) => Promise<string[]>;

    /**
     * @deprecated Use .loadTableSchemas() instead
     */
    getTableSchema: (
      tableName: string,
      schema?: string,
    ) => Promise<DataTable | undefined>;

    /**
     * @deprecated Use .tables or .loadTableSchemas() instead
     */
    getTableSchemas: (schema?: string) => Promise<DataTable[]>;

    /**
     * Check if a table exists
     */
    checkTableExists: (
      tableName: string | QualifiedTableName,
    ) => Promise<boolean>;

    /**
     * Delete a table with optional schema and database
     * @param tableName - The name of the table to delete (qualified or plain)
     */
    dropTable: (tableName: string | QualifiedTableName) => Promise<void>;

    /**
     * Create a table or view from a query.
     * @param tableName - The name of the table/view to create.
     * @param query - The query to create the table/view from.
     * @param options - Creation options.
     * @returns The table/view name and rowCount (undefined for views).
     */
    createTableFromQuery: (
      tableName: string | QualifiedTableName,
      query: string,
      options?: {
        replace?: boolean;
        temp?: boolean;
        view?: boolean;
        allowMultipleStatements?: boolean;
        abortSignal?: AbortSignal;
      },
    ) => Promise<{
      tableName: string | QualifiedTableName;
      rowCount: number | undefined;
    }>;

    /**
     * Parse a SQL SELECT statement to JSON
     * @param sql - The SQL SELECT statement to parse.
     * @returns A promise that resolves to the parsed JSON.
     */
    sqlSelectToJson: (sql: string) => Promise<
      | {
          error: true;
          error_type: string;
          error_message: string;
          error_subtype: string;
          position: string;
        }
      | {
          error: false;
          statements: {
            node: {
              from_table: {
                alias: string;
                show_type: string;
                table_name: string;
              };
              select_list: Record<string, unknown>[];
              type: string;
            };
          }[];
        }
    >;
  };
};

export type CreateDuckDbSliceProps = {
  connector?: DuckDbConnector;
};

/**
 * Create a DuckDB slice for managing the connector
 */
export function createDuckDbSlice({
  connector = createWasmDuckDbConnector(),
}: CreateDuckDbSliceProps = {}): StateCreator<DuckDbSliceState> {
  return createSlice<DuckDbSliceState, BaseRoomStoreState & DuckDbSliceState>(
    (set, get) => {
      return {
        db: {
          connector, // Will be initialized during init
          schema: 'main', // TODO: remove schema, we should not limit the schema to a single one.
          currentSchema: undefined,
          currentDatabase: undefined,
          isRefreshingTableSchemas: false,
          tables: [],
          tableRowCounts: {},
          schemaTrees: undefined,
          queryCache: {},

          setConnector: (connector: DuckDbConnector) => {
            set(
              produce((state) => {
                state.config.dataSources = [];
                state.db.connector = connector;
              }),
            );
          },

          initialize: async () => {
            await get().db.connector.initialize();
            await get().db.refreshTableSchemas();
          },

          getConnector: async () => {
            await get().db.connector.initialize();
            return get().db.connector;
          },

          destroy: async () => {
            try {
              if (get().db.connector) {
                await get().db.connector.destroy();
              }
            } catch (err) {
              console.error('Error during DuckDB shutdown:', err);
            }
          },

          /**
           * Creates a table or view from a SQL query.
           * @param tableName - Name of the table/view to create
           * @param query - SQL query (must be a SELECT statement, or multiple statements ending with a SELECT when allowMultipleStatements is true)
           * @param options - Creation options
           * @param options.replace - If true, uses CREATE OR REPLACE (default: true)
           * @param options.temp - If true, creates a temporary table/view (default: false)
           * @param options.view - If true, creates a view instead of a table (default: false)
           * @param options.allowMultipleStatements - If true, allows multiple statements where preceding statements are executed first and the final SELECT is wrapped in CREATE TABLE/VIEW (default: false)
           * @returns Object with tableName and rowCount (rowCount is undefined for views)
           */
          async createTableFromQuery(
            tableName: string | QualifiedTableName,
            query: string,
            options?: {
              replace?: boolean;
              temp?: boolean;
              view?: boolean;
              allowMultipleStatements?: boolean;
              abortSignal?: AbortSignal;
            },
          ) {
            const {
              replace = true,
              temp = false,
              view = false,
              allowMultipleStatements = false,
              abortSignal,
            } = options || {};

            // For temp tables/views, DuckDB requires the "temp" database
            const baseQualifiedName = isQualifiedTableName(tableName)
              ? tableName
              : makeQualifiedTableName({table: tableName});

            const qualifiedName = temp
              ? makeQualifiedTableName({
                  table: baseQualifiedName.table,
                  schema: baseQualifiedName.schema,
                  database: 'temp',
                })
              : baseQualifiedName;

            const connector = await get().db.getConnector();

            const {precedingStatements, lastStatement} =
              separateLastStatement(query);

            if (!allowMultipleStatements && precedingStatements.length > 0) {
              throw new Error(
                'Query must contain exactly one statement (set allowMultipleStatements: true to execute multiple statements)',
              );
            }

            // The last statement must be a SELECT
            const parsedQuery = await get().db.sqlSelectToJson(lastStatement);
            if (parsedQuery.error) {
              throw new Error(
                'Final statement must be a valid SELECT statement',
              );
            }

            // Build CREATE statement with options
            const createKeyword = [
              'CREATE',
              replace ? 'OR REPLACE' : '',
              temp ? 'TEMP' : '',
              view ? 'VIEW' : 'TABLE',
            ]
              .filter(Boolean)
              .join(' ');

            const createStatement = `${createKeyword} ${qualifiedName} AS (
              ${lastStatement}
            )`;

            const fullQuery = joinStatements(
              precedingStatements,
              createStatement,
            );
            const result = await connector.query(fullQuery, {
              signal: abortSignal,
            });
            // Views don't have a row count, only tables do
            const rowCount = view ? undefined : getColValAsNumber(result);
            return {tableName, rowCount};
          },

          /**
           * @deprecated Use .tables or .loadTableSchemas() instead
           */
          async getTables(schema) {
            const tableSchemas = await get().db.loadTableSchemas({schema});
            return tableSchemas.map((t) => t.table.table);
          },

          /**
           * @deprecated Use .loadTableSchemas() instead
           */
          async getTableSchema(tableName: string, schema = 'main') {
            const newLocal = await get().db.loadTableSchemas({
              schema,
              table: tableName,
            });
            return newLocal[0];
          },

          /**
           * @deprecated Use .loadTableRowCount() instead
           */
          async getTableRowCount(table, schema = 'main') {
            return get().db.loadTableRowCount({table, schema});
          },

          async loadTableRowCount(tableName: string | QualifiedTableName) {
            const {schema, database, table} =
              typeof tableName === 'string'
                ? {table: tableName}
                : tableName || {};
            const connector = await get().db.getConnector();
            const result = await connector.query(
              `SELECT COUNT(*) FROM ${makeQualifiedTableName({
                schema,
                database,
                table,
              })}`,
            );
            return getColValAsNumber(result);
          },

          /**
           * @deprecated Use .loadTableSchemas() instead
           */
          async getTableSchemas(schema) {
            return await get().db.loadTableSchemas({schema});
          },

          async loadTableSchemas(
            filter?: SchemaAndDatabase & {table?: string},
          ): Promise<DataTable[]> {
            const {schema, database, table} = filter || {};
            const sql = `WITH tables_and_views AS (
              FROM duckdb_tables() SELECT
                database_name AS database,
                schema_name AS schema,
                table_name AS name,
                sql,
                comment,
                estimated_size,
                FALSE AS isView
              UNION
              FROM duckdb_views() SELECT
                database_name AS database,
                schema_name AS schema,
                view_name AS name,
                sql,
                comment,
                NULL estimated_size,
                TRUE AS isView
            )
            SELECT
                isView,
                database, schema,
                name, column_names, column_types,
                sql, comment,
                estimated_size
            FROM (DESCRIBE)
            LEFT OUTER JOIN tables_and_views USING (database, schema, name)
            ${
              schema || database || table
                ? `WHERE ${[
                    schema ? `schema = ${escapeVal(schema)}` : '',
                    database ? `database = ${escapeVal(database)}` : '',
                    table ? `name = ${escapeVal(table)}` : '',
                  ]
                    .filter(Boolean)
                    .join(' AND ')}`
                : ''
            }`;
            const describeResults = await connector.query(sql);

            const newTables: DataTable[] = [];
            for (let i = 0; i < describeResults.numRows; i++) {
              const isView = describeResults.getChild('isView')?.get(i);
              const database = describeResults.getChild('database')?.get(i);
              const schema = describeResults.getChild('schema')?.get(i);
              const table = describeResults.getChild('name')?.get(i);
              const sql = describeResults.getChild('sql')?.get(i);
              const comment = describeResults.getChild('comment')?.get(i);
              const estimatedSize = describeResults
                .getChild('estimated_size')
                ?.get(i);
              const columnNames = describeResults
                .getChild('column_names')
                ?.get(i);
              const columnTypes = describeResults
                .getChild('column_types')
                ?.get(i);
              const columns: TableColumn[] = [];
              for (let di = 0; di < (columnNames?.length ?? 0); di++) {
                const columnName = String(columnNames.get(di));
                const columnType = String(columnTypes?.get(di));
                if (isDuckDbPlaceholderViewColumn(columnName, columnType)) {
                  continue;
                }
                columns.push({
                  name: columnName,
                  type: columnType,
                });
              }
              newTables.push({
                table: makeQualifiedTableName({database, schema, table}),
                database,
                schema,
                tableName: table,
                columns,
                sql,
                comment,
                isView: Boolean(isView),
                rowCount:
                  typeof estimatedSize === 'bigint'
                    ? Number(estimatedSize)
                    : estimatedSize === null
                      ? undefined
                      : estimatedSize,
              });
            }
            return newTables;
          },

          async checkTableExists(tableName: string | QualifiedTableName) {
            const qualifiedName = isQualifiedTableName(tableName)
              ? tableName
              : makeQualifiedTableName({table: tableName});
            const table = (await get().db.loadTableSchemas(qualifiedName))[0];
            if (!table) {
              return false;
            }
            return true;
          },

          async dropTable(tableName): Promise<void> {
            const connector = await get().db.getConnector();
            const qualifiedTable = isQualifiedTableName(tableName)
              ? tableName
              : makeQualifiedTableName({table: tableName});
            await connector.query(`DROP TABLE IF EXISTS ${qualifiedTable};`);
            await get().db.refreshTableSchemas();
          },

          async addTable(tableName, data) {
            const qualifiedName = isQualifiedTableName(tableName)
              ? tableName
              : makeQualifiedTableName({table: tableName});

            const {db} = get();
            if (data instanceof arrow.Table) {
              // TODO: make sure the table is replaced
              await db.connector.loadArrow(data, qualifiedName.toString());
            } else {
              await db.connector.loadObjects(data, qualifiedName.toString(), {
                replace: true,
              });
            }
            const newTable = (await db.loadTableSchemas(qualifiedName))[0];
            if (!newTable) {
              throw new Error('Failed to add table');
            }
            set((state) =>
              produce(state, (draft) => {
                draft.db.tables.push(newTable);
              }),
            );
            await get().db.refreshTableSchemas();
            return newTable;
          },

          async setTableRowCount(tableName, rowCount) {
            const qualifiedName = isQualifiedTableName(tableName)
              ? tableName
              : makeQualifiedTableName({table: tableName});
            set((state) =>
              produce(state, (draft) => {
                draft.db.tableRowCounts[qualifiedName.toString()] = rowCount;
              }),
            );
          },

          getTable(tableName) {
            return get().db.findTableByName(tableName);
          },

          findTableByName(tableName: string | QualifiedTableName) {
            const {table, schema, database} = {
              schema: get().db.currentSchema,
              database: get().db.currentDatabase,
              ...(typeof tableName === 'string'
                ? {table: tableName}
                : tableName),
            };
            return get().db.tables.find(
              (t) =>
                t.table.table === table &&
                (!schema || t.table.schema === schema) &&
                (!database || t.table.database === database),
            );
          },

          async refreshTableSchemas(): Promise<DataTable[]> {
            set((state) =>
              produce(state, (draft) => {
                draft.db.isRefreshingTableSchemas = true;
              }),
            );
            try {
              const connector = await get().db.getConnector();
              const result = await connector.query(
                `SELECT current_schema() AS schema, current_database() AS database`,
              );
              set((state) =>
                produce(state, (draft) => {
                  draft.db.currentSchema = result.getChild('schema')?.get(0);
                  draft.db.currentDatabase = result
                    .getChild('database')
                    ?.get(0);
                }),
              );
              const newTables = await get().db.loadTableSchemas();
              // Only update if there's an actual change in the schemas
              if (!deepEquals(newTables, get().db.tables)) {
                set((state) =>
                  produce(state, (draft) => {
                    draft.db.tables = newTables;
                    draft.db.schemaTrees = createDbSchemaTrees(newTables);
                  }),
                );
              }
              return newTables;
            } catch (err) {
              get().room.captureException(err);
              return [];
            } finally {
              set((state) =>
                produce(state, (draft) => {
                  draft.db.isRefreshingTableSchemas = false;
                }),
              );
            }
          },

          async sqlSelectToJson(sql: string) {
            const connector = await get().db.getConnector();
            const parsedQuery = (
              await connector.query(
                `SELECT json_serialize_sql(${escapeVal(sql)})`,
              )
            )
              .getChildAt(0)
              ?.get(0);
            return JSON.parse(parsedQuery);
          },

          async executeSql(query: string): Promise<QueryHandle | null> {
            // Create a unique key for this query
            const queryKey = `${query}`;
            const connector = await get().db.getConnector();

            // Check if we already have a cached query for this key
            const existingQuery = get().db.queryCache[queryKey];
            if (existingQuery) {
              return existingQuery;
            }

            const queryHandle = connector.query(query);
            // Cache the query handle immediately
            set((state) =>
              produce(state, (draft) => {
                draft.db.queryCache[queryKey] = queryHandle;
              }),
            );

            queryHandle.result.finally(() => {
              // remove from cache after completion
              set((state) =>
                produce(state, (draft) => {
                  delete draft.db.queryCache[queryKey];
                }),
              );
            });

            return queryHandle;
          },
        },
      };
    },
  );
}

/**
 * @internal
 * Select values from the room store that includes the DuckDB slice.
 *
 * This is a typed wrapper around `useBaseRoomStore` that narrows the
 * state to `RoomStateWithDuckDb` so selectors can access `db` safely.
 *
 * @typeParam T - The selected slice of state returned by the selector
 * @param selector - Function that selects a value from the store state
 * @returns The selected value of type `T`
 */
export function useStoreWithDuckDb<T>(
  selector: (state: BaseRoomStoreState & DuckDbSliceState) => T,
): T {
  return useBaseRoomStore<DuckDbSliceState, T>((state) => selector(state));
}
