import {createDuckDbSlice, CreateDuckDbSliceProps} from '@sqlrooms/duckdb';
import {escapeId, makeQualifiedTableName} from '@sqlrooms/duckdb-core';
import {createSlice, useBaseRoomStore} from '@sqlrooms/room-store';
import * as arrow from 'apache-arrow';
import {produce} from 'immer';
import {decodeArrowIpcChunk} from './arrow-streaming';
import {
  createDefaultDbConfig,
  hasLoadArrow,
  isDuplicateAttachError,
  isRuntimeCompatible,
} from './helpers';
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
} from './types';

export function createDbSlice(props?: {
  duckDb?: CreateDuckDbSliceProps;
  config?: Partial<DbSliceConfig>;
}) {
  const initialConfig = createDefaultDbConfig(props?.config);
  return createSlice<DbSliceState, DbRootState>((set, get, store) => {
    const duckDbSlice = createDuckDbSlice(props?.duckDb)(set, get, store);
    const isUnsupportedArrowUploadError = (error: unknown): boolean => {
      if (!error || typeof error !== 'object') {
        return false;
      }
      const message =
        'message' in error && typeof error.message === 'string'
          ? error.message.toLowerCase()
          : '';
      return message.includes(
        'arrow buffer upload is not supported over websocket backend',
      );
    };
    const toObjectRows = (table: arrow.Table): Record<string, unknown>[] => {
      return table
        .toArray()
        .map((row) =>
          Object.fromEntries(Object.entries(row as Record<string, unknown>)),
        );
    };
    // Keep ATTACH idempotent per alias (including concurrent callers) so the
    // server doesn't receive noisy duplicate ATTACH statements.
    const attachedDatabasePromises = new Map<string, Promise<void>>();
    const ensureAttachedDatabase = async (
      core: Awaited<ReturnType<DbSliceState['db']['getConnector']>>,
      attachedName: string,
    ): Promise<void> => {
      const existing = attachedDatabasePromises.get(attachedName);
      if (existing) {
        await existing;
        return;
      }

      const attachPromise = (async () => {
        try {
          await core.query(`ATTACH ':memory:' AS "${attachedName}"`);
        } catch (err) {
          if (!isDuplicateAttachError(err, attachedName)) {
            throw err;
          }
        }
      })();
      attachedDatabasePromises.set(attachedName, attachPromise);

      try {
        await attachPromise;
      } catch (err) {
        // Allow retries after non-duplicate attach failures.
        attachedDatabasePromises.delete(attachedName);
        throw err;
      }
    };
    const ensureSchemaExists = async (args: {
      core: Awaited<ReturnType<DbSliceState['db']['getConnector']>>;
      schema?: string;
      database?: string;
    }): Promise<void> => {
      const {core, schema, database} = args;
      if (!schema) {
        return;
      }
      if (database) {
        await core.query(
          `CREATE SCHEMA IF NOT EXISTS ${escapeId(database)}.${escapeId(schema)}`,
        );
        return;
      }
      await core.query(`CREATE SCHEMA IF NOT EXISTS ${escapeId(schema)}`);
    };
    const resolveMaterializationTarget = async (args: {
      relationName: string;
      schema?: string;
      database?: string;
    }): Promise<string> => {
      const {relationName, schema, database} = args;
      const core = await get().db.getConnector();
      const strategy = get().db.config.coreMaterialization.strategy;

      if (strategy === 'schema') {
        const schemaName =
          schema ?? get().db.config.coreMaterialization.schemaName;
        await ensureSchemaExists({core, schema: schemaName, database});
        return makeQualifiedTableName({
          database,
          schema: schemaName,
          table: relationName,
        }).toString();
      }

      const attachedName =
        database ?? get().db.config.coreMaterialization.attachedDatabaseName;
      // Strict ephemeral default: keep external materialized data in an attached
      // in-memory database scoped to runtime process.
      await ensureAttachedDatabase(core, attachedName);
      const schemaName = schema ?? 'main';
      await ensureSchemaExists({
        core,
        schema: schemaName,
        database: attachedName,
      });
      return makeQualifiedTableName({
        database: attachedName,
        schema: schemaName,
        table: relationName,
      }).toString();
    };
    const materializeArrowResult = async (args: {
      table: arrow.Table;
      relationName: string;
      schema?: string;
      database?: string;
    }): Promise<string> => {
      const {table, relationName, schema, database} = args;
      const core = await get().db.getConnector();
      if (!hasLoadArrow(core)) {
        throw new Error(
          'Core DuckDB connector does not support Arrow materialization',
        );
      }
      const qualified = await resolveMaterializationTarget({
        relationName,
        schema,
        database,
      });
      try {
        await core.loadArrow(table, qualified);
      } catch (error) {
        if (!isUnsupportedArrowUploadError(error)) {
          throw error;
        }
        // WS connectors cannot upload Arrow buffers; degrade gracefully to SQL
        // object ingestion so materialization still succeeds.
        await core.loadObjects(toObjectRows(table), qualified, {replace: true});
      }
      return qualified;
    };
    const materializeArrowStreamResult = async (args: {
      stream: AsyncIterable<Uint8Array>;
      relationName: string;
      schema?: string;
      database?: string;
    }): Promise<string> => {
      const {stream, relationName, schema, database} = args;
      const core = await get().db.getConnector();
      if (!hasLoadArrow(core)) {
        throw new Error(
          'Core DuckDB connector does not support Arrow materialization',
        );
      }
      const qualified = await resolveMaterializationTarget({
        relationName,
        schema,
        database,
      });
      let isFirstChunk = true;
      for await (const ipcChunk of stream) {
        const chunkTable = await decodeArrowIpcChunk(ipcChunk);
        if (chunkTable.numRows === 0) {
          continue;
        }
        if (isFirstChunk) {
          await materializeArrowResult({
            table: chunkTable,
            relationName,
            schema,
            database,
          });
          isFirstChunk = false;
          continue;
        }
        const tempChunkTable = `__sqlrooms_stream_chunk_${Date.now().toString(36)}_${Math.random()
          .toString(36)
          .slice(2, 8)}`;
        try {
          try {
            await core.loadArrow(chunkTable, tempChunkTable);
          } catch (error) {
            if (!isUnsupportedArrowUploadError(error)) {
              throw error;
            }
            await core.loadObjects(toObjectRows(chunkTable), tempChunkTable, {
              replace: true,
            });
          }
          await core.query(
            `INSERT INTO ${qualified} SELECT * FROM ${escapeId(tempChunkTable)}`,
          );
        } finally {
          await core.query(`DROP TABLE IF EXISTS ${escapeId(tempChunkTable)}`);
        }
      }
      if (isFirstChunk) {
        await core.query(
          `CREATE OR REPLACE TABLE ${qualified} AS SELECT * FROM (SELECT 1 AS __sqlrooms_empty__) WHERE FALSE`,
        );
      }
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
        const shouldMaterialize = request.materialize === true;
        if (shouldMaterialize) {
          const relationName =
            request.materializedName || `ext_${Date.now().toString(36)}`;
          const qualifiedRelation = await resolveMaterializationTarget({
            relationName,
            schema: request.materializedSchema,
            database: request.materializedDatabase,
          });
          await core.query(
            `CREATE OR REPLACE TABLE ${qualifiedRelation} AS (${request.sql})`,
            {
              signal: request.signal,
            },
          );
          return {
            connectionId,
            engineId,
            materialized: true,
            relationName: qualifiedRelation,
          };
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
        const shouldMaterialize = request.materialize !== false;
        const relationName =
          request.materializedName || `ext_${Date.now().toString(36)}`;
        if (shouldMaterialize && bridge.fetchArrowStream) {
          const stream = bridge.fetchArrowStream({
            connectionId,
            sql: request.sql,
            signal: request.signal,
            chunkRows: 5000,
          });
          const qualifiedRelation = await materializeArrowStreamResult({
            stream,
            relationName,
            schema: request.materializedSchema,
            database: request.materializedDatabase,
          });
          return {
            connectionId,
            engineId,
            materialized: true,
            relationName: qualifiedRelation,
          };
        }
        const arrowTable = await bridge.fetchArrow({
          connectionId,
          sql: request.sql,
          signal: request.signal,
        });
        if (!shouldMaterialize) {
          return {connectionId, engineId, materialized: false, arrowTable};
        }
        const qualifiedRelation = await materializeArrowResult({
          table: arrowTable,
          relationName,
          schema: request.materializedSchema,
          database: request.materializedDatabase,
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
        schema: request.materializedSchema,
        database: request.materializedDatabase,
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
