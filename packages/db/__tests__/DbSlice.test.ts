import * as arrow from 'apache-arrow';
import {createStore} from 'zustand';
import {jest} from '@jest/globals';
import {
  createBaseRoomSlice,
  type BaseRoomStoreState,
} from '@sqlrooms/room-store';
import {createDbSlice} from '../src/DbSlice';
import {isConnectionAvailable} from '../src/helpers';
import {DbConnection} from '../src/types';
import type {DbBridge, DbSliceState} from '../src/types';

type TestState = BaseRoomStoreState & DbSliceState;

function createMockCoreConnector() {
  return {
    initialize: jest.fn(async () => undefined),
    destroy: jest.fn(async () => undefined),
    query: jest.fn(async (_sql: string, _options?: {signal?: AbortSignal}) =>
      arrow.tableFromArrays({}),
    ),
    queryJson: jest.fn(
      async (_sql: string, _options?: {signal?: AbortSignal}) =>
        [] as Array<Record<string, unknown>>,
    ),
    execute: jest.fn(
      async (_sql: string, _options?: {signal?: AbortSignal}) => undefined,
    ),
    loadArrow: jest.fn(async (_table: arrow.Table, _name: string) => undefined),
    loadObjects: jest.fn(
      async (
        _rows: Array<Record<string, unknown>>,
        _name: string,
        _options?: {replace?: boolean},
      ) => undefined,
    ),
  };
}

function createTestStore() {
  const connector = createMockCoreConnector();
  const store = createStore<TestState>()((...args) => ({
    ...createBaseRoomSlice()(...args),
    ...createDbSlice({
      duckDb: {connector: connector as unknown as TestState['db']['connector']},
    })(...args),
  }));
  return {store, connector};
}

function ipcChunk(rows: Array<Record<string, unknown>>): Uint8Array {
  const table = arrow.tableFromJSON(rows);
  return arrow.tableToIPC(table, 'stream');
}

describe('canonical connections and driver availability', () => {
  it('retains unavailable definitions while blocking execution and catalog access', async () => {
    const {store} = createTestStore();
    const connection = DbConnection.parse({
      id: 'pg',
      engineId: 'postgres',
      title: 'Postgres',
      requiresBridge: true,
      bridgeId: 'server',
    });
    const executeQuery = jest.fn<DbBridge['executeQuery']>(async () => ({
      jsonData: [],
    }));
    const listCatalog = jest.fn<DbBridge['listCatalog']>(async () => ({
      databases: [],
      schemas: [],
      tables: [],
    }));
    const testConnection = jest.fn<DbBridge['testConnection']>(
      async () => true,
    );
    const {db} = store.getState();
    db.connectors.registerConnection(connection);
    db.connectors.registerBridge({
      id: 'server',
      runtimeSupport: 'server',
      executeQuery,
      listCatalog,
      testConnection,
      fetchArrow: async () => arrow.tableFromArrays({}),
      cancelQuery: async () => true,
    });
    db.connectors.setDiagnostics([{...connection, available: false}]);

    expect(db.connectors.listConnections()).toContainEqual(connection);
    expect(store.getState().db.config.connections.pg).toEqual(connection);
    expect(
      isConnectionAvailable(
        connection,
        store.getState().db.connectors.diagnostics,
      ),
    ).toBe(false);
    await expect(
      db.connectors.runQuery({
        connectionId: 'pg',
        sql: 'select 1',
        queryType: 'json',
      }),
    ).rejects.toThrow('Connection pg is unavailable');
    expect(await db.connectors.testConnection('pg')).toBe(false);
    expect(await db.connectors.listCatalog('pg')).toEqual([]);
    expect(executeQuery).not.toHaveBeenCalled();
    expect(testConnection).not.toHaveBeenCalled();
    expect(listCatalog).not.toHaveBeenCalled();

    // Updating diagnostics immediately permits execution without re-registering.
    db.connectors.setDiagnostics([{...connection, available: true}]);
    await db.connectors.runQuery({
      connectionId: 'pg',
      sql: 'select 1',
      queryType: 'json',
    });
    expect(executeQuery).toHaveBeenCalledTimes(1);
    expect(await db.connectors.testConnection('pg')).toBe(true);
    expect(await db.connectors.listCatalog('pg')).toHaveLength(1);

    db.connectors.removeConnection('pg');
    await expect(
      db.connectors.runQuery({connectionId: 'pg', sql: 'select 1'}),
    ).rejects.toThrow('Unknown connection: pg');
  });

  it('matches diagnostics by ID and engine, and leaves core DuckDB available', () => {
    const {store} = createTestStore();
    const {db} = store.getState();
    const core = db.config.connections[db.config.coreConnectionId]!;
    const connection = DbConnection.parse({
      id: 'pg',
      engineId: 'postgres',
      title: 'Postgres',
    });
    expect(isConnectionAvailable(connection, [])).toBe(true);
    expect(
      isConnectionAvailable(connection, [
        {...connection, id: 'other', available: false},
      ]),
    ).toBe(true);
    expect(
      isConnectionAvailable(connection, [
        {...connection, engineId: 'snowflake', available: false},
      ]),
    ).toBe(true);
    expect(isConnectionAvailable(core, [{...core, available: false}])).toBe(
      true,
    );
  });
});

describe('DbSlice runQuery bridge routing', () => {
  it('attaches ephemeral database only once for concurrent materialization', async () => {
    const {store, connector} = createTestStore();
    const fetchArrow = jest.fn<DbBridge['fetchArrow']>(async () =>
      arrow.tableFromJSON([{id: 1}]),
    );
    const bridge: DbBridge = {
      id: 'bridge-concurrent-attach',
      runtimeSupport: 'server',
      testConnection: async () => true,
      listCatalog: async () => ({databases: [], schemas: [], tables: []}),
      executeQuery: async () => ({jsonData: []}),
      fetchArrow,
      cancelQuery: async () => true,
    };

    store.getState().db.connectors.registerBridge(bridge);
    store.getState().db.connectors.registerConnection({
      id: 'athena',
      engineId: 'athena',
      title: 'Athena',
      runtimeSupport: 'server',
      requiresBridge: true,
      bridgeId: 'bridge-concurrent-attach',
      isCore: false,
    });
    store.getState().db.setConfig({
      ...store.getState().db.config,
      currentRuntime: 'browser',
    });

    await Promise.all([
      store.getState().db.connectors.runQuery({
        connectionId: 'athena',
        sql: 'select 1 as id',
        queryType: 'arrow',
        materialize: true,
        materializedName: 'result_a',
      }),
      store.getState().db.connectors.runQuery({
        connectionId: 'athena',
        sql: 'select 2 as id',
        queryType: 'arrow',
        materialize: true,
        materializedName: 'result_b',
      }),
    ]);

    const attachCount = connector.query.mock.calls.filter(
      (call) =>
        typeof call[0] === 'string' &&
        call[0].startsWith(
          `ATTACH ':memory:' AS "${store.getState().db.config.coreMaterialization.attachedDatabaseName}"`,
        ),
    ).length;
    expect(attachCount).toBe(1);
  });

  it('materializes bridge stream chunks into core relation', async () => {
    const {store, connector} = createTestStore();
    const fetchArrow = jest.fn<DbBridge['fetchArrow']>(async () =>
      arrow.tableFromArrays({}),
    );
    const fetchArrowStream = jest.fn<NonNullable<DbBridge['fetchArrowStream']>>(
      async function* () {
        yield ipcChunk([{id: 1}, {id: 2}]);
        yield ipcChunk([{id: 3}]);
      },
    );
    const bridge: DbBridge = {
      id: 'bridge-1',
      runtimeSupport: 'server',
      testConnection: async () => true,
      listCatalog: async () => ({databases: [], schemas: [], tables: []}),
      executeQuery: async () => ({jsonData: []}),
      fetchArrow,
      fetchArrowStream,
      cancelQuery: async () => true,
    };

    store.getState().db.connectors.registerBridge(bridge);
    store.getState().db.connectors.registerConnection({
      id: 'pg',
      engineId: 'postgres',
      title: 'Postgres',
      runtimeSupport: 'server',
      requiresBridge: true,
      bridgeId: 'bridge-1',
      isCore: false,
    });
    store.getState().db.setConfig({
      ...store.getState().db.config,
      currentRuntime: 'browser',
    });

    const result = await store.getState().db.connectors.runQuery({
      connectionId: 'pg',
      sql: 'select * from t',
      queryType: 'arrow',
      materialize: true,
      materializedName: 'result_1',
      materializedSchema: 'sheet_1',
    });

    expect(result.materialized).toBe(true);
    expect(result.relationName).toBeDefined();
    expect(fetchArrowStream).toHaveBeenCalledTimes(1);
    expect(fetchArrow).not.toHaveBeenCalled();
    expect(connector.loadArrow).toHaveBeenCalledTimes(2);
    const loadedTargets = connector.loadArrow.mock.calls.map((call) => call[1]);
    expect(loadedTargets[0]).toBe(result.relationName);
    expect(
      connector.query.mock.calls.some(
        (call) =>
          typeof call[0] === 'string' &&
          call[0].includes(`INSERT INTO ${result.relationName}`),
      ),
    ).toBe(true);
  });

  it('uses non-stream fetchArrow path when not materializing', async () => {
    const {store} = createTestStore();
    const bridgeTable = arrow.tableFromJSON([{id: 1}]);
    const fetchArrow = jest.fn<DbBridge['fetchArrow']>(async () => bridgeTable);
    const fetchArrowStream = jest.fn<NonNullable<DbBridge['fetchArrowStream']>>(
      async function* () {
        yield ipcChunk([{id: 1}]);
      },
    );
    const bridge: DbBridge = {
      id: 'bridge-2',
      runtimeSupport: 'server',
      testConnection: async () => true,
      listCatalog: async () => ({databases: [], schemas: [], tables: []}),
      executeQuery: async () => ({jsonData: []}),
      fetchArrow,
      fetchArrowStream,
      cancelQuery: async () => true,
    };

    store.getState().db.connectors.registerBridge(bridge);
    store.getState().db.connectors.registerConnection({
      id: 'sf',
      engineId: 'snowflake',
      title: 'Snowflake',
      runtimeSupport: 'server',
      requiresBridge: true,
      bridgeId: 'bridge-2',
      isCore: false,
    });
    store.getState().db.setConfig({
      ...store.getState().db.config,
      currentRuntime: 'browser',
    });

    const result = await store.getState().db.connectors.runQuery({
      connectionId: 'sf',
      sql: 'select * from t',
      queryType: 'arrow',
      materialize: false,
    });

    expect(result.materialized).toBe(false);
    expect(result.arrowTable?.numRows).toBe(1);
    expect(fetchArrow).toHaveBeenCalledTimes(1);
    expect(fetchArrowStream).not.toHaveBeenCalled();
  });
});
