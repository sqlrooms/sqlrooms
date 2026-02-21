import {DuckDbSliceState} from '@sqlrooms/duckdb';
import type {DuckDbConnector, QueryHandle} from '@sqlrooms/duckdb-core';
import type {BaseRoomStoreState} from '@sqlrooms/room-store';
import type * as arrow from 'apache-arrow';
import {z} from 'zod';

/**
 * Runtime availability for connectors and bridges.
 */
export const RuntimeSupport = z.enum(['browser', 'server', 'both']);
/**
 * Runtime availability for connectors and bridges.
 */
export type RuntimeSupport = z.infer<typeof RuntimeSupport>;

/**
 * Stable identifier for a database engine implementation (for example, duckdb,
 * postgres, snowflake).
 */
export const DbEngineId = z.string();
/**
 * Stable identifier for a database engine implementation.
 */
export type DbEngineId = z.infer<typeof DbEngineId>;

/**
 * Strategy used when materializing external connector results into core DuckDB.
 */
export const CoreMaterializationStrategy = z.enum([
  'schema',
  'attached_ephemeral',
]);
/**
 * Strategy used when materializing external connector results into core DuckDB.
 */
export type CoreMaterializationStrategy = z.infer<
  typeof CoreMaterializationStrategy
>;

/**
 * Configuration for how non-core results are stored in core DuckDB.
 */
export const CoreMaterializationConfig = z.object({
  strategy: CoreMaterializationStrategy.default('attached_ephemeral'),
  schemaName: z.string().default('__sqlrooms_external'),
  attachedDatabaseName: z.string().default('__sqlrooms_external_ephemeral'),
});
/**
 * Configuration for how non-core results are stored in core DuckDB.
 */
export type CoreMaterializationConfig = z.infer<
  typeof CoreMaterializationConfig
>;

/**
 * Declarative connection metadata used by the orchestration layer.
 */
export const DbConnection = z.object({
  id: z.string(),
  engineId: z.string(),
  title: z.string(),
  runtimeSupport: RuntimeSupport.default('both'),
  requiresBridge: z.boolean().default(false),
  bridgeId: z.string().optional(),
  isCore: z.boolean().default(false),
});
/**
 * Declarative connection metadata used by the orchestration layer.
 */
export type DbConnection = z.infer<typeof DbConnection>;

/**
 * Catalog database entry.
 */
export type CatalogDatabase = {
  database: string;
};

/**
 * Catalog schema entry.
 */
export type CatalogSchema = {
  database?: string;
  schema: string;
};

/**
 * Catalog table or view entry.
 */
export type CatalogTable = {
  database?: string;
  schema?: string;
  table: string;
  isView?: boolean;
};

/**
 * Catalog column description.
 */
export type CatalogColumn = {
  name: string;
  type: string;
};

/**
 * Table entry enriched with column metadata.
 */
export type CatalogTableDetails = CatalogTable & {
  columns: CatalogColumn[];
};

/**
 * Optional capability flags exposed by a connector.
 */
export type DbConnectorCapabilities = {
  catalog?: boolean;
  parser?: boolean;
  ingestion?: boolean;
};

/**
 * Connector interface for direct, in-runtime query execution.
 *
 * It extends the common query API and optionally exposes catalog introspection.
 */
export type DbConnector = Pick<
  DuckDbConnector,
  'initialize' | 'destroy' | 'execute' | 'query' | 'queryJson'
> & {
  capabilities?: DbConnectorCapabilities;
  listDatabases?: () => Promise<CatalogDatabase[]>;
  listSchemas?: (database?: string) => Promise<CatalogSchema[]>;
  listTables?: (args?: {
    database?: string;
    schema?: string;
  }) => Promise<CatalogTable[]>;
  describeTable?: (args: {
    database?: string;
    schema?: string;
    table: string;
  }) => Promise<CatalogTableDetails | undefined>;
};

/**
 * Bridge interface for delegated (typically backend) execution.
 *
 * Bridges are used when a connection cannot run directly in the current runtime.
 */
export type DbBridge = {
  id: string;
  runtimeSupport: RuntimeSupport;
  testConnection: (connectionId: string) => Promise<boolean>;
  listCatalog: (connectionId: string) => Promise<{
    databases: CatalogDatabase[];
    schemas: CatalogSchema[];
    tables: CatalogTable[];
  }>;
  executeQuery: (args: {
    connectionId: string;
    sql: string;
    queryType: 'exec' | 'json';
    signal?: AbortSignal;
  }) => Promise<{jsonData?: Iterable<Record<string, unknown>>}>;
  fetchArrow: (args: {
    connectionId: string;
    sql: string;
    signal?: AbortSignal;
  }) => Promise<arrow.Table>;
  cancelQuery: (queryId: string) => Promise<boolean>;
};

/**
 * Request payload for routed query execution.
 */
export type QueryExecutionRequest = {
  /**
   * Target connection id. If omitted, core DuckDB is used.
   */
  connectionId?: string;
  /**
   * SQL statement(s) to execute.
   */
  sql: string;
  /**
   * Expected result shape.
   */
  queryType?: 'arrow' | 'json' | 'exec';
  /**
   * Whether arrow results from non-core connectors should be materialized into
   * core DuckDB. Defaults to true for arrow queries.
   */
  materialize?: boolean;
  /**
   * Optional target relation name used when materializing.
   */
  materializedName?: string;
  /**
   * Abort signal for cancellation.
   */
  signal?: AbortSignal;
};

/**
 * Response payload from routed query execution.
 */
export type QueryExecutionResult = {
  /**
   * Connection id that handled the query.
   */
  connectionId: string;
  /**
   * Engine id for the handling connection.
   */
  engineId: string;
  /**
   * Indicates whether result data was materialized into core DuckDB.
   */
  materialized: boolean;
  /**
   * Qualified relation name created in core DuckDB when materialized is true.
   */
  relationName?: string;
  /**
   * Arrow result table for arrow queries.
   */
  arrowTable?: arrow.Table;
  /**
   * JSON rows for json queries.
   */
  jsonData?: Iterable<Record<string, unknown>>;
  /**
   * Execution handle for exec queries when available.
   */
  execHandle?: QueryHandle;
};

/**
 * Aggregated catalog snapshot for a single connection.
 */
export type CatalogEntry = {
  connectionId: string;
  engineId: string;
  databases: CatalogDatabase[];
  schemas: CatalogSchema[];
  tables: CatalogTable[];
};

/**
 * Global configuration for the DB orchestration layer.
 *
 * This config sits at `state.db.config` and controls:
 * - Runtime routing behavior (`currentRuntime`)
 * - Which connection is treated as the core DuckDB engine (`coreConnectionId`)
 * - How external query results are materialized into core DuckDB
 *   (`coreMaterialization`)
 * - The known connection registry (`connections`)
 */
export type DbSliceConfig = {
  /**
   * Runtime where this store instance executes.
   * Used to decide whether a connection can run directly or must be bridged.
   */
  currentRuntime: RuntimeSupport;
  /**
   * Connection id of the core DuckDB engine used as the canonical execution
   * and materialization target.
   */
  coreConnectionId: string;
  /**
   * Strategy for materializing non-core connector results into core DuckDB.
   */
  coreMaterialization: CoreMaterializationConfig;
  /**
   * Registered connections keyed by connection id.
   */
  connections: Record<string, DbConnection>;
};

/**
 * State shape contributed by `createDbSlice`.
 *
 * The API is intentionally split into:
 * - `db` for core DuckDB operations plus orchestration config
 * - `db.connectors` for connector/bridge registry and query routing actions
 */
export type DbSliceState = {
  db: DuckDbSliceState['db'] & {
    /**
     * Orchestration config shared by connector actions.
     */
    config: DbSliceConfig;
    /**
     * Replace the full orchestration config.
     */
    setConfig: (config: DbSliceConfig) => void;
    /**
     * Connector orchestration actions and registries.
     */
    connectors: {
      connectors: Record<string, DbConnector>;
      /**
       * Registered bridge transports keyed by bridge id.
       *
       * A bridge is a runtime boundary adapter (usually HTTP/WebSocket) used to
       * execute queries in another runtime (for example browser -> server) when a
       * connection cannot be executed directly in the current environment.
       */
      bridges: Record<string, DbBridge>;
      registerConnection: (connection: DbConnection) => void;
      removeConnection: (connectionId: string) => void;
      registerConnector: (connectionId: string, connector: DbConnector) => void;
      registerBridge: (bridge: DbBridge) => void;
      listConnections: () => DbConnection[];
      testConnection: (connectionId: string) => Promise<boolean>;
      listCatalog: (connectionId?: string) => Promise<CatalogEntry[]>;
      runQuery: (
        request: QueryExecutionRequest,
      ) => Promise<QueryExecutionResult>;
    };
  };
};

/**
 * Root store type that includes DB orchestration state.
 */
export type DbRootState = BaseRoomStoreState & DbSliceState;
