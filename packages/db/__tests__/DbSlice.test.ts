import * as arrow from 'apache-arrow';
import {createStore} from 'zustand';
import {jest} from '@jest/globals';
import {
  createBaseRoomSlice,
  type BaseRoomStoreState,
} from '@sqlrooms/room-store';
import {createDbSlice} from '../src/DbSlice';
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

describe('DbSlice runQuery bridge routing', () => {
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
