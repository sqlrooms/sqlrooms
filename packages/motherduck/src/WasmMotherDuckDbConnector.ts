import {MDConnection, MDConnectionParams} from '@motherduck/wasm-client';
import {
  BaseDuckDbConnectorImpl,
  createBaseDuckDbConnector,
  DuckDbConnector,
} from '@sqlrooms/duckdb';
import * as arrow from 'apache-arrow';
import {RecordBatch} from 'apache-arrow';

export type MotherDuckDbConnectorType = 'wasm-motherduck';

export type MotherDuckDbConnectorOptions = {
  type: MotherDuckDbConnectorType;
} & WasmMotherDuckDbConnectorOptions;

export function isWasmMotherDuckDbConnector(
  connector: DuckDbConnector,
): connector is WasmMotherDuckDbConnector {
  return (connector as any).type === 'wasm-motherduck';
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

      // Check if already cancelled before starting
      if (signal.aborted) {
        throw new DOMException('Query was cancelled', 'AbortError');
      }

      // Not using evaluateQueuedQuery which supports cancellation
      // because it doesn't provide arrow results
      const result = await connection.evaluateStreamingQuery(query);
      const batches = new Array<RecordBatch<any>>();

      for await (const batch of result.arrowStream) {
        // Check for cancellation before processing each batch
        if (signal.aborted) {
          throw new DOMException('Query was cancelled', 'AbortError');
        }
        batches.push(batch);
      }

      return new arrow.Table(batches);
    },

    async cancelQueryInternal(queryId: string) {
      // Cancellation is handled by checking AbortSignal in the stream reading loop
      // No server-side cancellation is performed since evaluateStreamingQuery doesn't provide queryId
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
