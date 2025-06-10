import {
  createBaseSlice,
  ProjectState,
  useBaseProjectStore,
} from '@sqlrooms/project';
import * as arrow from 'apache-arrow';
import deepEquals from 'fast-deep-equal';
import {produce} from 'immer';
import {z} from 'zod';
import {StateCreator} from 'zustand';
import {DuckDbConnector, QueryHandle} from './connectors/DuckDbConnector';
import {WasmDuckDbConnector} from './connectors/WasmDuckDbConnector';
import {
  escapeVal,
  getColValAsNumber,
  makeQualifiedTableName,
  splitSqlStatements,
} from './duckdb-utils';
import {createDbSchemaTrees as createDbSchemaTrees} from './schemaTree';
import {DataTable, TableColumn, DbSchemaNode} from './types';

export const DuckDbSliceConfig = z.object({
  // nothing yet
});
export type DuckDbSliceConfig = z.infer<typeof DuckDbSliceConfig>;

export type SchemaAndDatabase = {
  schema?: string;
  database?: string;
};

export function createDefaultDuckDbConfig(): DuckDbSliceConfig {
  return {
    // nothing yet
  };
}

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
    isRefreshingTableSchemas: boolean;
    tables: DataTable[];
    tableRowCounts: {[tableName: string]: number};
    schemaTrees?: DbSchemaNode[];
    queryCache: {[key: string]: QueryHandle};

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
     * Add a table to the project.
     * @param tableName - The name of the table to add.
     * @param data - The data to add to the table: an arrow table or an array of records.
     * @returns A promise that resolves to the table that was added.
     */
    addTable(
      tableName: string,
      data: arrow.Table | Record<string, unknown>[],
    ): Promise<DataTable>;
    getTable(tableName: string): DataTable | undefined;
    setTableRowCount(tableName: string, rowCount: number): void;
    findTableByName(tableName: string): DataTable | undefined;
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
     * Get the tables in the database
     *
     * @param schema - The schema to get the tables from. Defaults to 'main'. Pass '*' to get all tables.
     * @returns The tables in the database.
     */
    getTables: (
      options?:
        | SchemaAndDatabase
        | string /** string is deprecated, kept for backwards compatibility */,
    ) => Promise<string[]>;

    /**
     * Get the row count of a table
     */
    getTableRowCount: (tableName: string, schema?: string) => Promise<number>;

    /**
     * Execute a query with query handle (not result) caching and deduplication
     * @param query - The SQL query to execute
     * @returns The QueryHandle for the query or null if disabled
     */
    executeSql: (query: string) => Promise<QueryHandle | null>;

    /**
     * Get the schema of a table
     */
    getTableSchema: (
      tableName: string,
      options?: SchemaAndDatabase | string,
    ) => Promise<DataTable>;

    /**
     * Get the schemas of all tables in the database.
     *
     * @param schema - The schema to get the tables from. Defaults to 'main'. Pass '*' to get all schemas.
     * @returns The schemas of all tables in the database.
     */
    getTableSchemas: (
      options?:
        | SchemaAndDatabase
        | string /** string is deprecated, kept for backwards compatibility */,
    ) => Promise<DataTable[]>;

    /**
     * Check if a table exists
     */
    checkTableExists: (
      tableName: string,
      options?:
        | SchemaAndDatabase
        | string /** string is deprecated, kept for backwards compatibility */,
    ) => Promise<boolean>;

    /**
     * Delete a table with optional schema and database
     * @param tableName - The name of the table to delete
     * @param options - Optional parameters including schema and database
     */
    dropTable: (
      tableName: string,
      options?: SchemaAndDatabase,
    ) => Promise<void>;

    /**
     * Create a table from a query.
     * @param tableName - The name of the table to create.
     * @param query - The query to create the table from.
     * @returns The table that was created.
     */
    createTableFromQuery: (
      tableName: string,
      query: string,
    ) => Promise<{tableName: string; rowCount: number}>;

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
  connector = new WasmDuckDbConnector(),
}: {
  connector?: DuckDbConnector;
}): StateCreator<DuckDbSliceState> {
  return createBaseSlice<DuckDbSliceConfig, DuckDbSliceState>((set, get) => {
    return {
      db: {
        connector, // Will be initialized during init
        schema: 'main',
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
        },

        getConnector: async () => {
          await get().db.initialize();
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
          tableName: string,
          query: string,
          options?: {schema?: string; database?: string},
        ) {
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
              `CREATE OR REPLACE TABLE main.${tableName} AS (
              ${statements[0]}
            )`,
            ).result,
          );
          return {tableName, rowCount};
        },

        async getTables(
          options?: SchemaAndDatabase | string,
        ): Promise<string[]> {
          // const connector = await get().db.getConnector();
          // const {schema = 'main', database} =
          //   typeof options === 'string' ? {schema: options} : options || {};
          // const tablesResults = await connector.query(
          //   `SELECT * FROM information_schema.tables
          //   ${schema === '*' ? '' : `WHERE table_schema = '${schema}' ${database ? `AND table_catalog = '${database}'` : ''}`}
          //   ORDER BY table_name`,
          // ).result;
          // const tableNames: string[] = [];
          // for (let i = 0; i < tablesResults.numRows; i++) {
          //   tableNames.push(tablesResults.getChild('table_name')?.get(i));
          // }
          // return tableNames;
        },

        async getTableSchema(
          tableName: string,
          options?: SchemaAndDatabase | string,
        ): Promise<DataTable> {
          const connector = await get().db.getConnector();
          const {schema = 'main', database} =
            typeof options === 'string' ? {schema: options} : options || {};
          const describeResults = await connector.query(
            `DESCRIBE ${makeQualifiedTableName({schema, database, tableName})}`,
          ).result;
          const columnNames = describeResults.getChild('column_name');
          const columnTypes = describeResults.getChild('column_type');
          const columns: TableColumn[] = [];
          for (let di = 0; di < describeResults.numRows; di++) {
            const columnName = columnNames?.get(di);
            const columnType = columnTypes?.get(di);
            columns.push({name: columnName, type: columnType});
          }
          return {
            database: undefined,
            schema,
            tableName,
            columns,
          };
        },

        async getTableRowCount(
          tableName: string,
          schema = 'main',
        ): Promise<number> {
          const connector = await get().db.getConnector();
          const result = await connector.query(
            `SELECT COUNT(*) FROM ${schema}.${tableName}`,
          ).result;
          return getColValAsNumber(result);
        },

        async getTableSchemas(
          options?: SchemaAndDatabase | string,
        ): Promise<DataTable[]> {
          const connector = await get().db.getConnector();
          const {schema = 'main', database} =
            typeof options === 'string' ? {schema: options} : options || {};
          const describeResults = await connector.query(
            `FROM (DESCRIBE) SELECT database, schema, name, column_names, column_types
            ${schema || database ? `WHERE ${schema ? `schema = '${schema}'` : ''} ${database ? `AND database = '${database}'` : ''}` : ''}`,
          ).result;

          const newTables: DataTable[] = [];
          for (let i = 0; i < describeResults.numRows; i++) {
            const database = describeResults.getChild('database')?.get(i);
            const schema = describeResults.getChild('schema')?.get(i);
            const tableName = describeResults.getChild('name')?.get(i);
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
            newTables.push({database, schema, tableName, columns});
          }
          return newTables;
        },

        async checkTableExists(tableName, options): Promise<boolean> {
          const connector = await get().db.getConnector();
          const {schema = 'main', database} =
            typeof options === 'string' ? {schema: options} : options || {};
          const res = await connector.query(
            `SELECT
               COUNT(*) FROM information_schema.tables
             WHERE
               table_schema = '${schema}'
               ${database ? `AND table_catalog = '${database}'` : ''}
               AND table_name = '${tableName}'`,
          ).result;
          return getColValAsNumber(res) > 0;
        },

        async dropTable(tableName, options): Promise<void> {
          const connector = await get().db.getConnector();
          const qualifiedTable = makeQualifiedTableName({
            ...options,
            tableName,
          });
          await connector.query(`DROP TABLE IF EXISTS ${qualifiedTable};`)
            .result;
          await get().db.refreshTableSchemas();
        },

        async addTable(tableName, data) {
          const {tables} = get().db;
          const table = tables.find((t) => t.tableName === tableName);
          if (table) {
            return table;
          }

          const {db} = get();
          if (data instanceof arrow.Table) {
            await db.connector.loadArrow(data, tableName);
          } else {
            await db.connector.loadObjects(data, tableName);
          }
          const newTable = await db.getTableSchema(tableName);

          set((state) =>
            produce(state, (draft) => {
              draft.db.tables.push(newTable);
            }),
          );
          await get().db.refreshTableSchemas();
          return newTable;
        },

        setTableRowCount: (tableName, rowCount) =>
          set((state) =>
            produce(state, (draft) => {
              draft.db.tableRowCounts[tableName] = rowCount;
            }),
          ),

        getTable(tableName) {
          return get().db.tables.find((t) => t.tableName === tableName);
        },

        findTableByName(tableName: string) {
          return get().db.tables.find((t) => t.tableName === tableName);
        },

        async refreshTableSchemas(): Promise<DataTable[]> {
          set((state) =>
            produce(state, (draft) => {
              draft.db.isRefreshingTableSchemas = true;
            }),
          );
          try {
            const newTables = await get().db.getTableSchemas('*');
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
            get().project.captureException(err);
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
            ).result
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

type ProjectStateWithDuckDb = ProjectState<DuckDbSliceConfig> &
  DuckDbSliceState;

export function useStoreWithDuckDb<T>(
  selector: (state: ProjectStateWithDuckDb) => T,
): T {
  return useBaseProjectStore<
    DuckDbSliceConfig,
    ProjectState<DuckDbSliceConfig>,
    T
  >((state) => selector(state as unknown as ProjectStateWithDuckDb));
}
