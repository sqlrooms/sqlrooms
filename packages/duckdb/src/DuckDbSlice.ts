import {
  createBaseSlice,
  ProjectState,
  useBaseProjectStore,
} from '@sqlrooms/project';
import * as arrow from 'apache-arrow';
import {produce} from 'immer';
import deepEquals from 'fast-deep-equal';
import {z} from 'zod';
import {StateCreator} from 'zustand';
import {DuckDbConnector} from './connectors/DuckDbConnector';
import {WasmDuckDbConnector} from './connectors/WasmDuckDbConnector';
import {getColValAsNumber} from './duckdb-utils';
import {DataTable, TableColumn} from './types';

export const DuckDbSliceConfig = z.object({
  // nothing yet
});
export type DuckDbSliceConfig = z.infer<typeof DuckDbSliceConfig>;

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
    schema: string;

    tables: DataTable[];
    tableRowCounts: {[tableName: string]: number};

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
    getTables: (schema?: string) => Promise<string[]>;

    /**
     * Get the row count of a table
     */
    getTableRowCount: (tableName: string, schema?: string) => Promise<number>;

    /**
     * Get the schema of a table
     */
    getTableSchema: (tableName: string, schema?: string) => Promise<DataTable>;

    /**
     * Get the schemas of all tables in the database.
     *
     * @param schema - The schema to get the tables from. Defaults to 'main'. Pass '*' to get all schemas.
     * @returns The schemas of all tables in the database.
     */
    getTableSchemas: (schema?: string) => Promise<DataTable[]>;

    /**
     * Check if a table exists
     */
    checkTableExists: (tableName: string, schema?: string) => Promise<boolean>;

    /**
     * Drop a table
     */
    dropTable: (tableName: string) => Promise<void>;

    /**
     * Check if a table exists
     */
    tableExists: (tableName: string, schema?: string) => Promise<boolean>;

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
        tables: [],
        tableRowCounts: {},

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

        async createTableFromQuery(tableName: string, query: string) {
          const connector = await get().db.getConnector();
          const rowCount = getColValAsNumber(
            await connector.query(
              `CREATE OR REPLACE TABLE main.${tableName} AS (
              ${query}
            )`,
            ),
          );
          return {tableName, rowCount};
        },

        async getTables(schema = 'main'): Promise<string[]> {
          const connector = await get().db.getConnector();
          const tablesResults = await connector.query(
            `SELECT * FROM information_schema.tables 
           ${schema === '*' ? '' : `WHERE table_schema = '${schema}'`}
           ORDER BY table_name`,
          );
          const tableNames: string[] = [];
          for (let i = 0; i < tablesResults.numRows; i++) {
            tableNames.push(tablesResults.getChild('table_name')?.get(i));
          }
          return tableNames;
        },

        async getTableSchema(
          tableName: string,
          schema = 'main',
        ): Promise<DataTable> {
          const connector = await get().db.getConnector();
          const describeResults = await connector.query(
            `DESCRIBE ${schema}.${tableName}`,
          );
          const columnNames = describeResults.getChild('column_name');
          const columnTypes = describeResults.getChild('column_type');
          const columns: TableColumn[] = [];
          for (let di = 0; di < describeResults.numRows; di++) {
            const columnName = columnNames?.get(di);
            const columnType = columnTypes?.get(di);
            columns.push({name: columnName, type: columnType});
          }
          return {
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
          );
          return getColValAsNumber(result);
        },

        async getTableSchemas(schema = 'main'): Promise<DataTable[]> {
          const tableNames = await get().db.getTables(schema);
          const tablesInfo: DataTable[] = [];
          for (const tableName of tableNames) {
            tablesInfo.push(await get().db.getTableSchema(tableName, schema));
          }
          return tablesInfo;
        },

        async checkTableExists(
          tableName: string,
          schema = 'main',
        ): Promise<boolean> {
          const connector = await get().db.getConnector();
          const res = await connector.query(
            `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '${schema}' AND table_name = '${tableName}'`,
          );
          return getColValAsNumber(res) > 0;
        },

        async dropTable(tableName: string): Promise<void> {
          const connector = await get().db.getConnector();
          await connector.query(`DROP TABLE IF EXISTS ${tableName};`);
        },

        async tableExists(
          tableName: string,
          schema = 'main',
        ): Promise<boolean> {
          const connector = await get().db.getConnector();
          const result = await connector.query(
            `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '${schema}' AND table_name = '${tableName}'`,
          );
          return Number(result.getChildAt(0)?.get(0)) > 0;
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
          const newTables = await get().db.getTableSchemas();
          const currentTables = get().db.tables;

          // Only update if there's an actual change in the schemas
          if (!deepEquals(newTables, currentTables)) {
            set((state) =>
              produce(state, (draft) => {
                draft.db.tables = newTables;
              }),
            );
          }
          return newTables;
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
