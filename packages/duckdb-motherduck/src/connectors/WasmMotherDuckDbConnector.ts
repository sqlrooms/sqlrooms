import {MDConnection, MDConnectionParams} from '@motherduck/wasm-client';
import {
  createBaseDuckDbConnector,
  BaseDuckDbConnectorImpl,
  DuckDbConnector,
} from '@sqlrooms/duckdb';
import * as arrow from 'apache-arrow';

function valueToJS(value: any): any {
  if (value && typeof value === 'object' && typeof value.toJS === 'function') {
    return value.toJS();
  }
  return value;
}

export interface WasmMotherDuckDbConnectorOptions extends MDConnectionParams {
  initializationQuery?: string;
}

export interface WasmMotherDuckDbConnector extends DuckDbConnector {
  getConnection(): MDConnection;
  readonly type: 'wasm-motherduck';
}

export function createWasmMotherDuckDbConnector(
  options: WasmMotherDuckDbConnectorOptions,
): WasmMotherDuckDbConnector {
  const {initializationQuery = '', ...params} = options;
  let connection: MDConnection | null = null;
  const queryIdMap = new Map<string, string>();

  const impl: BaseDuckDbConnectorImpl = {
    async initializeInternal() {
      connection = MDConnection.create(params);
      await connection.isInitialized();
      if (initializationQuery) {
        await connection.evaluateQuery(initializationQuery);
      }
    },

    async destroyInternal() {
      if (connection) {
        await connection.close();
        connection = null;
      }
    },

    async executeQueryInternal(
      query: string,
      signal: AbortSignal,
      id: string,
    ): Promise<arrow.Table> {
      if (!connection) {
        throw new Error('MotherDuck connection not initialized');
      }
      const mdId = connection.enqueueQuery(query);
      queryIdMap.set(id, mdId);
      const abortHandler = () => {
        connection!.cancelQuery(mdId).catch(() => {});
      };
      signal.addEventListener('abort', abortHandler);
      try {
        const result = await connection.evaluateQueuedQuery(mdId);
        const rows = result.data.toRows().map((row: any) => {
          const obj: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(row)) {
            obj[k] = valueToJS(v);
          }
          return obj;
        });
        if (rows.length === 0) {
          return arrow.tableFromArrays({});
        }
        return arrow.tableFromJSON(rows);
      } finally {
        signal.removeEventListener('abort', abortHandler);
        queryIdMap.delete(id);
      }
    },

    async cancelQueryInternal(queryId: string) {
      const mdId = queryIdMap.get(queryId);
      if (mdId && connection) {
        await connection.cancelQuery(mdId).catch(() => {});
      }
    },
  };

  const base = createBaseDuckDbConnector({initializationQuery}, impl);

  return {
    ...base,
    getConnection() {
      if (!connection) {
        throw new Error('MotherDuck connection not initialized');
      }
      return connection;
    },
    get type() {
      return 'wasm-motherduck' as const;
    },
  };
}
