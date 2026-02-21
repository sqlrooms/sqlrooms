import {DuckDbSliceState} from '@sqlrooms/duckdb';
import type {DuckDbConnector, QueryHandle} from '@sqlrooms/duckdb-core';
import type {BaseRoomStoreState} from '@sqlrooms/room-store';
import type * as arrow from 'apache-arrow';
import {z} from 'zod';

export const RuntimeSupport = z.enum(['browser', 'server', 'both']);
export type RuntimeSupport = z.infer<typeof RuntimeSupport>;

export const DbEngineId = z.string();
export type DbEngineId = z.infer<typeof DbEngineId>;

export const CoreMaterializationStrategy = z.enum([
  'schema',
  'attached_ephemeral',
]);
export type CoreMaterializationStrategy = z.infer<
  typeof CoreMaterializationStrategy
>;

export const CoreMaterializationConfig = z.object({
  strategy: CoreMaterializationStrategy.default('attached_ephemeral'),
  schemaName: z.string().default('__sqlrooms_external'),
  attachedDatabaseName: z.string().default('__sqlrooms_external_ephemeral'),
});
export type CoreMaterializationConfig = z.infer<
  typeof CoreMaterializationConfig
>;

export const DbConnection = z.object({
  id: z.string(),
  engineId: z.string(),
  title: z.string(),
  runtimeSupport: RuntimeSupport.default('both'),
  requiresBridge: z.boolean().default(false),
  bridgeId: z.string().optional(),
  isCore: z.boolean().default(false),
});
export type DbConnection = z.infer<typeof DbConnection>;

export type CatalogDatabase = {
  database: string;
};

export type CatalogSchema = {
  database?: string;
  schema: string;
};

export type CatalogTable = {
  database?: string;
  schema?: string;
  table: string;
  isView?: boolean;
};

export type CatalogColumn = {
  name: string;
  type: string;
};

export type CatalogTableDetails = CatalogTable & {
  columns: CatalogColumn[];
};

export type DbConnectorCapabilities = {
  catalog?: boolean;
  parser?: boolean;
  ingestion?: boolean;
};

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

export type QueryExecutionRequest = {
  connectionId?: string;
  sql: string;
  queryType?: 'arrow' | 'json' | 'exec';
  materialize?: boolean;
  materializedName?: string;
  signal?: AbortSignal;
};

export type QueryExecutionResult = {
  connectionId: string;
  engineId: string;
  materialized: boolean;
  relationName?: string;
  arrowTable?: arrow.Table;
  jsonData?: Iterable<Record<string, unknown>>;
  execHandle?: QueryHandle;
};

export type CatalogEntry = {
  connectionId: string;
  engineId: string;
  databases: CatalogDatabase[];
  schemas: CatalogSchema[];
  tables: CatalogTable[];
};

export type DbSliceConfig = {
  currentRuntime: RuntimeSupport;
  coreConnectionId: string;
  coreMaterialization: CoreMaterializationConfig;
  connections: Record<string, DbConnection>;
};

export type DbSliceState = {
  db: DuckDbSliceState['db'];
  dbx: {
    config: DbSliceConfig;
    connectors: Record<string, DbConnector>;
    bridges: Record<string, DbBridge>;
    setConfig: (config: DbSliceConfig) => void;
    registerConnection: (connection: DbConnection) => void;
    removeConnection: (connectionId: string) => void;
    registerConnector: (connectionId: string, connector: DbConnector) => void;
    registerBridge: (bridge: DbBridge) => void;
    listConnections: () => DbConnection[];
    testConnection: (connectionId: string) => Promise<boolean>;
    listCatalog: (connectionId?: string) => Promise<CatalogEntry[]>;
    runQuery: (request: QueryExecutionRequest) => Promise<QueryExecutionResult>;
  };
};

export type DbRootState = BaseRoomStoreState & DbSliceState;
