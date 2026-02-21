import {createDuckDbSlice, CreateDuckDbSliceProps} from '@sqlrooms/duckdb';
import {makeQualifiedTableName} from '@sqlrooms/duckdb-core';
import {createSlice, useBaseRoomStore} from '@sqlrooms/room-store';
import type * as arrow from 'apache-arrow';
import {produce} from 'immer';
import type {
  CatalogEntry,
  DbBridge,
  DbConnection,
  DbConnector,
  DbRootState,
  DbSliceConfig,
  DbSliceState,
  QueryExecutionRequest,
  QueryExecutionResult,
  RuntimeSupport,
} from './types';

function createDefaultDbConfig(config?: Partial<DbSliceConfig>): DbSliceConfig {
  const coreConnectionId = config?.coreConnectionId ?? 'duckdb-core';
  const runtime: RuntimeSupport = config?.currentRuntime ?? 'both';
  return {
    currentRuntime: runtime,
    coreConnectionId,
    coreMaterialization: {
      strategy: 'attached_ephemeral',
      schemaName: '__sqlrooms_external',
      attachedDatabaseName: '__sqlrooms_external_ephemeral',
      ...config?.coreMaterialization,
    },
    connections: {
      [coreConnectionId]: {
        id: coreConnectionId,
        engineId: 'duckdb',
        title: 'Core DuckDB',
        runtimeSupport: 'both',
        requiresBridge: false,
        isCore: true,
      },
      ...(config?.connections ?? {}),
    },
  };
}

function isRuntimeCompatible(
  current: RuntimeSupport,
  support: RuntimeSupport,
): boolean {
  return support === 'both' || current === support;
}

export function createDbSlice(props?: {
  duckDb?: CreateDuckDbSliceProps;
  config?: Partial<DbSliceConfig>;
}) {
  const initialConfig = createDefaultDbConfig(props?.config);
  return createSlice<DbSliceState, DbRootState>((set, get, store) => {
    const duckDbSlice = createDuckDbSlice(props?.duckDb)(set, get, store);
    const materializeArrowResult = async (args: {
      table: arrow.Table;
      relationName: string;
    }): Promise<string> => {
      const {table, relationName} = args;
      const core = await get().db.getConnector();
      if (!('loadArrow' in core) || typeof core.loadArrow !== 'function') {
        throw new Error(
          'Core DuckDB connector does not support Arrow materialization',
        );
      }

      const strategy = get().db.config.coreMaterialization.strategy;
      if (strategy === 'schema') {
        const schemaName = get().db.config.coreMaterialization.schemaName;
        await core.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
        const qualified = makeQualifiedTableName({
          schema: schemaName,
          table: relationName,
        }).toString();
        await core.loadArrow(table, qualified);
        return qualified;
      }

      const attachedName =
        get().db.config.coreMaterialization.attachedDatabaseName;
      // Strict ephemeral default: keep external materialized data in an attached
      // in-memory database scoped to runtime process.
      try {
        await core.query(`ATTACH ':memory:' AS "${attachedName}"`);
      } catch {
        // Ignore duplicate attach errors in steady-state.
      }
      const qualified = makeQualifiedTableName({
        database: attachedName,
        schema: 'main',
        table: relationName,
      }).toString();
      await core.loadArrow(table, qualified);
      return qualified;
    };

    const runQuery = async (
      request: QueryExecutionRequest,
    ): Promise<QueryExecutionResult> => {
      const queryType = request.queryType ?? 'arrow';
      const config = get().db.config;
      const connectionId = request.connectionId ?? config.coreConnectionId;
      const connection = config.connections[connectionId];
      if (!connection) {
        throw new Error(`Unknown connection: ${connectionId}`);
      }

      const engineId = connection.engineId;
      const connector = get().db.connectors.connectors[connectionId];
      const currentRuntime = config.currentRuntime;
      const needsBridge =
        connection.requiresBridge ||
        !isRuntimeCompatible(currentRuntime, connection.runtimeSupport);

      if (connectionId === config.coreConnectionId) {
        const core = await get().db.getConnector();
        if (queryType === 'exec') {
          const execHandle = core.execute(request.sql, {
            signal: request.signal,
          });
          await execHandle;
          return {connectionId, engineId, materialized: false, execHandle};
        }
        if (queryType === 'json') {
          const jsonHandle = core.queryJson<Record<string, unknown>>(
            request.sql,
            {
              signal: request.signal,
            },
          );
          const jsonData = await jsonHandle;
          return {connectionId, engineId, materialized: false, jsonData};
        }
        const arrowHandle = core.query(request.sql, {signal: request.signal});
        const arrowTable = await arrowHandle;
        return {connectionId, engineId, materialized: false, arrowTable};
      }

      if (needsBridge) {
        const bridgeId = connection.bridgeId;
        const bridge: DbBridge | undefined = bridgeId
          ? get().db.connectors.bridges[bridgeId]
          : undefined;
        if (!bridge) {
          throw new Error(
            `Connection ${connectionId} requires bridge but no bridge configured`,
          );
        }
        if (queryType === 'exec' || queryType === 'json') {
          const bridgeResult = await bridge.executeQuery({
            connectionId,
            sql: request.sql,
            queryType: queryType === 'exec' ? 'exec' : 'json',
            signal: request.signal,
          });
          return {
            connectionId,
            engineId,
            materialized: false,
            jsonData: bridgeResult.jsonData,
          };
        }
        const arrowTable = await bridge.fetchArrow({
          connectionId,
          sql: request.sql,
          signal: request.signal,
        });
        const shouldMaterialize = request.materialize !== false;
        if (!shouldMaterialize) {
          return {connectionId, engineId, materialized: false, arrowTable};
        }
        const relationName =
          request.materializedName || `ext_${Date.now().toString(36)}`;
        const qualifiedRelation = await materializeArrowResult({
          table: arrowTable,
          relationName,
        });
        return {
          connectionId,
          engineId,
          materialized: true,
          relationName: qualifiedRelation,
          arrowTable,
        };
      }

      if (!connector) {
        throw new Error(
          `No connector registered for connection ${connectionId}`,
        );
      }
      if (queryType === 'exec') {
        const execHandle = connector.execute(request.sql, {
          signal: request.signal,
        });
        await execHandle;
        return {connectionId, engineId, materialized: false, execHandle};
      }
      if (queryType === 'json') {
        const jsonHandle = connector.queryJson<Record<string, unknown>>(
          request.sql,
          {
            signal: request.signal,
          },
        );
        const jsonData = await jsonHandle;
        return {connectionId, engineId, materialized: false, jsonData};
      }
      const arrowHandle = connector.query(request.sql, {
        signal: request.signal,
      });
      const arrowTable = await arrowHandle;
      const shouldMaterialize = request.materialize !== false;
      if (!shouldMaterialize) {
        return {connectionId, engineId, materialized: false, arrowTable};
      }
      const relationName =
        request.materializedName || `ext_${Date.now().toString(36)}`;
      const qualifiedRelation = await materializeArrowResult({
        table: arrowTable,
        relationName,
      });
      return {
        connectionId,
        engineId,
        materialized: true,
        relationName: qualifiedRelation,
        arrowTable,
      };
    };

    return {
      db: {
        ...duckDbSlice.db,
        config: initialConfig,
        setConfig: (config) => {
          set((state) =>
            produce(state, (draft) => {
              draft.db.config = config;
            }),
          );
        },
        connectors: {
          connectors: {},
          bridges: {},
          registerConnection: (connection: DbConnection) => {
            set((state) =>
              produce(state, (draft) => {
                draft.db.config.connections[connection.id] = connection;
              }),
            );
          },
          removeConnection: (connectionId: string) => {
            set((state) =>
              produce(state, (draft) => {
                delete draft.db.config.connections[connectionId];
                delete draft.db.connectors.connectors[connectionId];
              }),
            );
          },
          registerConnector: (connectionId: string, connector: DbConnector) => {
            set((state) =>
              produce(state, (draft) => {
                draft.db.connectors.connectors[connectionId] = connector;
              }),
            );
          },
          registerBridge: (bridge: DbBridge) => {
            set((state) =>
              produce(state, (draft) => {
                draft.db.connectors.bridges[bridge.id] = bridge;
              }),
            );
          },
          listConnections: () => Object.values(get().db.config.connections),
          testConnection: async (connectionId: string) => {
            const connection = get().db.config.connections[connectionId];
            if (!connection) return false;
            if (connection.id === get().db.config.coreConnectionId) return true;
            const connector = get().db.connectors.connectors[connectionId];
            if (connector) {
              try {
                await connector.initialize();
                return true;
              } catch {
                return false;
              }
            }
            if (connection.bridgeId) {
              const bridge = get().db.connectors.bridges[connection.bridgeId];
              if (!bridge) return false;
              return bridge.testConnection(connectionId);
            }
            return false;
          },
          listCatalog: async (
            connectionId?: string,
          ): Promise<CatalogEntry[]> => {
            const ids = connectionId
              ? [connectionId]
              : Object.keys(get().db.config.connections);
            const entries: CatalogEntry[] = [];

            for (const id of ids) {
              const connection = get().db.config.connections[id];
              if (!connection) continue;
              if (id === get().db.config.coreConnectionId) {
                const tables = await get().db.loadTableSchemas();
                entries.push({
                  connectionId: id,
                  engineId: connection.engineId,
                  databases: [],
                  schemas: [],
                  tables: tables.map((t) => ({
                    database: t.table.database,
                    schema: t.table.schema,
                    table: t.table.table,
                    isView: t.isView,
                  })),
                });
                continue;
              }
              const connector = get().db.connectors.connectors[id];
              if (
                connector?.listDatabases ||
                connector?.listSchemas ||
                connector?.listTables
              ) {
                const [databases, schemas, tables] = await Promise.all([
                  connector.listDatabases?.() ?? Promise.resolve([]),
                  connector.listSchemas?.() ?? Promise.resolve([]),
                  connector.listTables?.() ?? Promise.resolve([]),
                ]);
                entries.push({
                  connectionId: id,
                  engineId: connection.engineId,
                  databases,
                  schemas,
                  tables,
                });
                continue;
              }
              if (connection.bridgeId) {
                const bridge = get().db.connectors.bridges[connection.bridgeId];
                if (bridge) {
                  const catalog = await bridge.listCatalog(id);
                  entries.push({
                    connectionId: id,
                    engineId: connection.engineId,
                    databases: catalog.databases,
                    schemas: catalog.schemas,
                    tables: catalog.tables,
                  });
                }
              }
            }
            return entries;
          },
          runQuery,
        },
      },
    };
  });
}

type RoomStateWithDb = DbRootState;

export function useStoreWithDb<T>(selector: (state: RoomStateWithDb) => T): T {
  return useBaseRoomStore<RoomStateWithDb, T>(selector);
}
