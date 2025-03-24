import {BaseProjectConfig} from '@sqlrooms/project';
import {produce} from 'immer';
import {z} from 'zod';
import {StateCreator} from 'zustand';
import {DuckDbConnector} from './types';
import {WasmDuckDbConnector} from './WasmDuckDbConnector';

export const DataSourceTypes = z.enum(['file', 'url', 'sql']);
export type DataSourceTypes = z.infer<typeof DataSourceTypes>;

export const BaseDataSource = z.object({
  type: DataSourceTypes,
  tableName: z
    .string()
    .describe(
      'Unique table name used to store the data loaded from the data source.',
    ),
});
export type BaseDataSource = z.infer<typeof BaseDataSource>;

export const FileDataSource = BaseDataSource.extend({
  type: z.literal(DataSourceTypes.enum.file),
  fileName: z
    .string()
    .describe('Currently only CSV and Parquet files are supported.'),
});
export type FileDataSource = z.infer<typeof FileDataSource>;

export const UrlDataSource = BaseDataSource.extend({
  type: z.literal(DataSourceTypes.enum.url),
  url: z
    .string()
    .describe(
      'URL to fetch data from. Currently only CSV and Parquet files are supported.',
    ),
});
export type UrlDataSource = z.infer<typeof UrlDataSource>;

export const SqlQueryDataSource = BaseDataSource.extend({
  type: z.literal(DataSourceTypes.enum.sql),
  sqlQuery: z.string().describe('SQL query to execute.'),
});
export type SqlQueryDataSource = z.infer<typeof SqlQueryDataSource>;

export const DataSource = z
  .discriminatedUnion('type', [
    FileDataSource,
    UrlDataSource,
    SqlQueryDataSource,
  ])
  .describe('Data source specification.');
export type DataSource = z.infer<typeof DataSource>;

/**
 * Configuration for the DuckDB slice
 */
export const DuckDbSliceConfig = z.object({
  dataSources: z.array(DataSource),
});
export type DuckDbSliceConfig = z.infer<typeof DuckDbSliceConfig>;

export function createDefaultDuckDbConfig(): DuckDbSliceConfig {
  return {
    dataSources: [],
  };
}

/**
 * State and actions for the DuckDB slice
 */
export type DuckDbSliceState = {
  duckdb: {
    tasksProgress: Record<string, TaskProgress>;
    tables: DataTable[];
    projectFiles: ProjectFileInfo[];
    projectFilesProgress: {[pathname: string]: ProjectFileState};
    initialized: boolean; // Whether the project has been initialized so we can render UI
    isDataAvailable: boolean; // Whether the data has been loaded (on initialization)
    dataSourceStates: {[tableName: string]: DataSourceState}; // TODO
    tableRowCounts: {[tableName: string]: number};
    /**
     * The DuckDB connector instance
     */
    connector: DuckDbConnector;

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

    addOrUpdateSqlQueryDataSource(
      tableName: string,
      query: string,
      oldTableName?: string,
    ): Promise<void>;
    removeSqlQueryDataSource(tableName: string): Promise<void>;
    maybeDownloadDataSources(): Promise<void>;
  };
};

/**
 * Create a DuckDB slice for managing the connector
 */
export function createDuckDbSlice<
  PC extends BaseProjectConfig & DuckDbSliceConfig,
>({
  connector = new WasmDuckDbConnector(),
}: {
  connector?: DuckDbConnector;
}): StateCreator<DuckDbSliceState> {
  return (set, get) => ({
    duckdb: {
      connector, // Will be initialized during init

      setConnector: (connector: DuckDbConnector) => {
        set(
          produce((state) => {
            state.duckdb.connector = connector;
          }),
        );
      },

      initialize: async () => {
        // If connector already exists, just initialize it
        if (get().duckdb.connector) {
          await get().duckdb.connector.initialize();
          return;
        }

        // Create a new connector if none exists
        try {
          await connector.initialize();

          set(
            produce((state) => {
              state.duckdb.connector = connector;
            }),
          );
        } catch (err) {
          console.error('Failed to initialize DuckDB connector:', err);
          throw err;
        }
      },

      destroy: async () => {
        try {
          if (get().duckdb.connector) {
            await get().duckdb.connector.destroy();
          }
        } catch (err) {
          console.error('Error during DuckDB shutdown:', err);
        }
      },
    },
  });
}
