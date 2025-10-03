import {
  createBaseSlice,
  RoomState,
  useBaseRoomStore,
} from '@sqlrooms/room-store';
import * as arrow from 'apache-arrow';
import deepEquals from 'fast-deep-equal';
import {produce} from 'immer';
import {StateCreator} from 'zustand';
import {DuckDbConnector, QueryHandle} from './connectors/DuckDbConnector';
import {createWasmDuckDbConnector} from './connectors/createDuckDbConnector';
import {
  escapeId,
  escapeVal,
  getColValAsNumber,
  isQualifiedTableName,
  makeQualifiedTableName,
  QualifiedTableName,
  splitSqlStatements,
} from './duckdb-utils';
import {createDbSchemaTrees} from './schemaTree';
import {DataTable, DbSchemaNode, TableColumn} from './types';

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
    executeSql: (query: string) => Promise<QueryHandle | null>;

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
     * @param tableName - The name of the table to delete
     * @param options - Optional parameters including schema and database
     */
    dropTable: (tableName: string | QualifiedTableName) => Promise<void>;

    /**
     * Create a table from a query.
     * @param tableName - The name of the table to create.
     * @param query - The query to create the table from.
     * @returns The table that was created.
     */
    createTableFromQuery: (
      tableName: string | QualifiedTableName,
      query: string,
    ) => Promise<{tableName: string | QualifiedTableName; rowCount: number}>;

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

/**
 * Create a DuckDB slice for managing the connector
 */
export function createDuckDbSlice({
  connector = createWasmDuckDbConnector(),
}: {
  connector?: DuckDbConnector;
}): StateCreator<DuckDbSliceState> {
  return createBaseSlice<{}, DuckDbSliceState>((set, get) => {
    return {
      db: {
        connector, // Will be initialized during init
        schema: 'main', // TODO: remove schema, we should not limit the schema to a single one.
        currentSchema: undefined,
        currentDatabase: undefined,
        isRefreshingTableSchemas: false,
        tables: [],
        tableRowCounts: {},
        schemaTree: undefined,
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

        async createTableFromQuery(
          tableName: string | QualifiedTableName,
          query: string,
        ) {
          const qualifiedName = isQualifiedTableName(tableName)
            ? tableName
            : makeQualifiedTableName({table: tableName});

          const connector = await get().db.getConnector();

          const statements = splitSqlStatements(query);
          if (statements.length !== 1) {
            throw new Error('Query must contain exactly one statement');
          }
          const statement = statements[0] as string;
          const parsedQuery = await get().db.sqlSelectToJson(statement);
          if (parsedQuery.error) {
            throw new Error('Query is not a valid SELECT statement');
          }

          const rowCount = getColValAsNumber(
            await connector.query(
              `CREATE OR REPLACE TABLE ${qualifiedName} AS (
              ${statements[0]}
            )`,
            ),
          );
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
          const describeResults = await connector.query(
            `WITH tables_and_views AS (
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
                    schema ? `schema = '${escapeId(schema)}'` : '',
                    database ? `database = '${escapeId(database)}'` : '',
                    table ? `name = '${escapeId(table)}'` : '',
                  ]
                    .filter(Boolean)
                    .join(' AND ')}`
                : ''
            }`,
          );

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
            for (let di = 0; di < columnNames.length; di++) {
              columns.push({
                name: columnNames.get(di),
                type: columnTypes.get(di),
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
            ...(typeof tableName === 'string' ? {table: tableName} : tableName),
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
                draft.db.currentDatabase = result.getChild('database')?.get(0);
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
  });
}

type RoomStateWithDuckDb = RoomState<{}> & DuckDbSliceState;

export function useStoreWithDuckDb<T>(
  selector: (state: RoomStateWithDuckDb) => T,
): T {
  return useBaseRoomStore<{}, RoomState<{}>, T>((state) =>
    selector(state as unknown as RoomStateWithDuckDb),
  );
}
