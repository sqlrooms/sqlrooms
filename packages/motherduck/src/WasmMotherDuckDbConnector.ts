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
    },

    async destroyInternal() {
      if (connection) {
        await connection.close();
        connection = null;
      }
    },

    async executeQueryInternal(
      query: string | string[],
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

      // Helper function to execute a single statement
      const executeStatement = async (
        stmt: string,
        buildTable: boolean,
      ): Promise<arrow.Table | null> => {
        // Not using evaluateQueuedQuery which supports cancellation
        // because it doesn't provide arrow results
        const result = await connection.evaluateStreamingQuery(stmt);

        if (buildTable) {
          // Build table for the result
          const batches = new Array<RecordBatch<any>>();

          for await (const batch of result.arrowStream) {
            // Check for cancellation before processing each batch
            if (signal.aborted) {
              throw new DOMException('Query was cancelled', 'AbortError');
            }
            batches.push(batch);
          }

          return new arrow.Table(batches);
        } else {
          // Just consume the stream to ensure completion
          for await (const batch of result.arrowStream) {
            // Check for cancellation before processing each batch
            if (signal.aborted) {
              throw new DOMException('Query was cancelled', 'AbortError');
            }
            // Don't store the batch, just consume it
          }
          return null;
        }
      };

      // Handle multiple statements by executing them individually
      if (Array.isArray(query)) {
        let lastResult: arrow.Table | null = null;

        for (let i = 0; i < query.length; i++) {
          if (signal.aborted) {
            throw new DOMException('Query was cancelled', 'AbortError');
          }

          const stmt = query[i]?.trim();
          if (!stmt) continue; // Skip empty statements

          const isLastStatement = i === query.length - 1;
          const result = await executeStatement(stmt, isLastStatement);

          if (isLastStatement && result) {
            lastResult = result;
          }
        }

        // Return the result from the last statement, or empty table if no statements
        return lastResult || new arrow.Table([]);
      } else {
        // Single statement execution
        const result = await executeStatement(query, true);
        return result || new arrow.Table([]);
      }
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
