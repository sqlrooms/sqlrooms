import * as arrow from 'apache-arrow';
import {
  BaseDuckDbConnectorImpl,
  createBaseDuckDbConnector,
} from './BaseDuckDbConnector';
import {DuckDbConnector} from './DuckDbConnector';
import {
  LoadFileOptions,
  StandardLoadOptions,
  isSpatialLoadFileOptions,
} from '@sqlrooms/room-config';
import {load, loadObjects, loadSpatial} from './load/load';
import {splitFilePath} from '@sqlrooms/utils';

export interface WebSocketDuckDbConnectorOptions {
  /**
   * WebSocket endpoint of the FastAPI DuckDB server.
   * Defaults to `ws://localhost:4000/`.
   */
  wsUrl?: string;

  /** SQL to run after initialization */
  initializationQuery?: string;
}

export interface WebSocketDuckDbConnector extends DuckDbConnector {
  readonly type: 'ws';
}

/**
 * Create a DuckDB connector that talks to a FastAPI backend over WebSockets.
 *
 * Protocol expectations (as implemented by `server.py`):
 * - Client sends a text JSON message: { type: 'arrow', sql: string, queryId?: string }
 * - Server responds with a single binary message containing Arrow IPC stream bytes
 *   or a text JSON message: { error: string }
 * - Cancellation: client sends { type: 'cancel', queryId } and closes socket.
 */
export function createWebSocketDuckDbConnector(
  options: WebSocketDuckDbConnectorOptions = {},
): WebSocketDuckDbConnector {
  const {wsUrl = 'ws://localhost:4000/', initializationQuery = ''} = options;

  const impl: BaseDuckDbConnectorImpl = {
    async initializeInternal() {
      // No persistent connection required; connections are per-query.
      // This keeps concurrency simple since server replies are not correlated.
    },

    async destroyInternal() {
      // No state to clean up (per-query sockets are short-lived)
    },

    async executeQueryInternal<T extends arrow.TypeMap = any>(
      query: string,
      signal: AbortSignal,
      queryId?: string,
    ): Promise<arrow.Table<T>> {
      if (signal.aborted) {
        throw new DOMException('Query was cancelled', 'AbortError');
      }

      return new Promise<arrow.Table<T>>((resolve, reject) => {
        let ws: WebSocket | null = null;
        let settled = false;
        let sent = false;

        const settleReject = (err: any) => {
          if (settled) return;
          settled = true;
          try {
            signal.removeEventListener('abort', onAbort);
          } catch {}
          reject(err instanceof Error ? err : new Error(String(err)));
        };

        const settleResolve = (value: arrow.Table<T>) => {
          if (settled) return;
          settled = true;
          try {
            signal.removeEventListener('abort', onAbort);
          } catch {}
          resolve(value);
        };

        const onAbort = () => {
          try {
            if (ws && ws.readyState === WebSocket.OPEN && sent && queryId) {
              try {
                ws.send(JSON.stringify({type: 'cancel', queryId}));
              } catch {}
            }
            ws?.close();
          } catch {}
          settleReject(new DOMException('Query was cancelled', 'AbortError'));
        };

        signal.addEventListener('abort', onAbort, {once: true});

        try {
          ws = new WebSocket(wsUrl);
          ws.binaryType = 'arraybuffer';

          ws.onopen = () => {
            try {
              const message = JSON.stringify({
                type: 'arrow',
                sql: query,
                queryId,
              });
              ws!.send(message);
              sent = true;
            } catch (err) {
              settleReject(err);
            }
          };

          ws.onmessage = async (event: MessageEvent) => {
            try {
              if (typeof event.data === 'string') {
                // Expect JSON error shape { error: string }
                try {
                  const parsed = JSON.parse(event.data);
                  if (parsed && parsed.error) {
                    settleReject(new Error(parsed.error));
                  } else if (parsed && parsed.type === 'cancelAck') {
                    // Ignore; local abort already rejected the promise
                  } else {
                    settleReject(
                      new Error('Unexpected text message from server'),
                    );
                  }
                } catch (e) {
                  settleReject(new Error('Invalid JSON message from server'));
                }
                return;
              }

              let buffer: ArrayBuffer;
              if (event.data instanceof ArrayBuffer) {
                buffer = event.data;
              } else if (event.data instanceof Blob) {
                buffer = await event.data.arrayBuffer();
              } else {
                reject(new Error('Unsupported binary message type'));
                return;
              }

              const uint8 = new Uint8Array(buffer);
              const reader = await arrow.RecordBatchReader.from(uint8);
              const batches: arrow.RecordBatch<T>[] = [];
              for await (const batch of reader) {
                batches.push(batch as arrow.RecordBatch<T>);
              }
              const table = batches.length
                ? new arrow.Table(reader.schema, batches)
                : (arrow.tableFromArrays({}) as unknown as arrow.Table<T>);
              settleResolve(table);
            } catch (err) {
              settleReject(err);
            } finally {
              try {
                ws?.close();
              } catch {}
            }
          };

          ws.onerror = (ev) => {
            settleReject(new Error('WebSocket error'));
            try {
              ws?.close();
            } catch {}
          };

          ws.onclose = (ev) => {
            // If server closes before sending a result and we haven't resolved/rejected,
            // the Promise will hang; however, typical flows resolve in onmessage.
          };
        } catch (err) {
          signal.removeEventListener('abort', onAbort);
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      });
    },

    async loadFileInternal(
      file: string | File,
      tableName: string,
      opts?: LoadFileOptions,
    ) {
      // This backend executes SQL on a remote DuckDB. For local files, the path must
      // be accessible to the server process.
      const filePath = file instanceof File ? file.name : file;
      const {ext} = splitFilePath(filePath);
      if (ext === 'arrow') {
        // No dedicated insert endpoint over WS; fall back to SQL semantics.
        // Users should provide a server-accessible path.
        const sql = `CREATE OR REPLACE TABLE ${tableName} AS SELECT * FROM read_ipc('${filePath}')`;
        await impl.executeQueryInternal?.(sql, new AbortController().signal);
        return;
      }

      let sql: string;
      if (opts && isSpatialLoadFileOptions(opts)) {
        sql = loadSpatial(tableName, filePath, opts);
      } else {
        sql = load(opts?.method ?? 'auto', tableName, filePath, opts);
      }
      await impl.executeQueryInternal?.(sql, new AbortController().signal);
    },

    async loadArrowInternal(
      _file: arrow.Table | Uint8Array,
      _tableName: string,
    ) {
      // Not supported over current WS protocol (no upload path). Use loadFileInternal
      // with a server-accessible Arrow IPC file path instead.
      throw new Error(
        'Arrow buffer upload is not supported over WebSocket backend',
      );
    },

    async loadObjectsInternal(
      file: Record<string, unknown>[],
      tableName: string,
      opts?: StandardLoadOptions,
    ) {
      const sql = loadObjects(tableName, file, opts);
      await impl.executeQueryInternal?.(sql, new AbortController().signal);
    },
  };

  const base = createBaseDuckDbConnector(
    {initializationQuery: initializationQuery},
    impl,
  );

  return {
    ...base,
    get type() {
      return 'ws' as const;
    },
  };
}
