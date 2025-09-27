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
import {ControlMessagesConnector} from './ControlMessagesConnector';

/**
 * Options for the WebSocket DuckDB connector.
 *
 * @public
 */
export interface WebSocketDuckDbConnectorOptions {
  /**
   * WebSocket endpoint of the DuckDB server.
   */
  wsUrl?: string;

  /** SQL to run after initialization */
  initializationQuery?: string;

  /** Optional handler for server notifications `{ type: 'notify', payload }` */
  onNotification?: (payload: any) => void;

  /** Optional list of channels to subscribe to upon (re)connect */
  subscribeChannels?: string[];

  /** Optional bearer token to authenticate with the server */
  authToken?: string;
}

export type WebSocketDuckDbConnector = DuckDbConnector &
  ControlMessagesConnector;

/**
 * Create a DuckDB connector that talks to a WebSocket backend.
 *
 * Protocol expectations (as implemented by the servers):
 * - Persistent connection; messages are correlated via `queryId`.
 * - Client sends JSON: `{ type: 'arrow', sql: string, queryId?: string }`.
 * - Server responds with a binary frame for Arrow results using framing:
 *   `[4-byte big-endian header length][header JSON { type, queryId }][Arrow IPC stream bytes]`.
 * - Errors are sent as JSON text frames: `{ type: 'error', queryId, error }`.
 * - Cancellation: client sends `{ type: 'cancel', queryId }` and keeps socket open.
 * - Notifications: server may push `{ type: 'notify', payload }` as JSON text.
 */
/**
 * Create a WebSocket-based DuckDB connector.
 *
 * @public
 */
export function createWebSocketDuckDbConnector(
  options: WebSocketDuckDbConnectorOptions = {},
): WebSocketDuckDbConnector {
  const {
    wsUrl = 'ws://localhost:4000',
    initializationQuery = '',
    subscribeChannels,
    authToken,
  } = options;

  // Persistent socket and per-query waiters
  let socket: WebSocket | null = null;
  let opening: Promise<void> | null = null;
  let lastSubscribedChannels: string[] | undefined = subscribeChannels;
  const notificationListeners = new Set<(payload: any) => void>();
  const pending = new Map<
    string,
    {
      resolve: (table: arrow.Table<any>) => void;
      reject: (err: any) => void;
    }
  >();

  const closeAndRejectAll = (reason: string) => {
    for (const [qid, waiter] of pending.entries()) {
      try {
        waiter.reject(new Error(reason));
      } catch {}
      pending.delete(qid);
    }
  };

  // Guard to avoid duplicate subscribe sends on open + initialize
  const resubscribe = () => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    if (!lastSubscribedChannels || lastSubscribedChannels.length === 0) return;
    for (const ch of lastSubscribedChannels) {
      try {
        socket.send(JSON.stringify({type: 'subscribe', channel: ch}));
      } catch {}
    }
  };

  const ensureSocket = (): Promise<void> => {
    if (socket && socket.readyState === WebSocket.OPEN)
      return Promise.resolve();
    if (opening) return opening;
    opening = new Promise<void>((resolve, reject) => {
      try {
        const ws = new WebSocket(wsUrl);
        socket = ws;
        ws.binaryType = 'arraybuffer';

        let authAcked = !authToken;

        ws.onopen = () => {
          // If auth is required, perform first-message auth and wait for ack
          try {
            if (authToken) {
              try {
                ws.send(JSON.stringify({type: 'auth', token: authToken}));
              } catch {}
            } else {
              // No auth required; resolve immediately
              opening = null;
              resubscribe();
              resolve();
            }
          } catch {}
        };

        ws.onmessage = (event: MessageEvent) => {
          (async () => {
            if (typeof event.data === 'string') {
              let parsed: any;
              try {
                parsed = JSON.parse(event.data);
              } catch {
                return;
              }
              const t = parsed?.type;
              if (!authAcked) {
                if (t === 'authAck') {
                  authAcked = true;
                  opening = null;
                  // Subscribe once authed
                  resubscribe();
                  resolve();
                } else if (t === 'error') {
                  const msg = parsed?.error || 'Unauthorized';
                  opening = null;
                  reject(new Error(msg));
                }
                return;
              }
              if (t === 'cancelAck') return;
              if (t === 'notify') {
                const payload = parsed?.payload;
                try {
                  options.onNotification?.(payload);
                } catch {}
                try {
                  for (const fn of notificationListeners) fn(payload);
                } catch {}
                return;
              }
              // After initialization: if we ever receive a global unauthorized error, throw and close
              if (t === 'error') {
                const errMsg = String(parsed?.error || '').toLowerCase();
                const hasQid = typeof parsed?.queryId === 'string';
                if (!hasQid && errMsg.includes('unauthorized')) {
                  closeAndRejectAll('Unauthorized');
                  try {
                    ws.close();
                  } catch {}
                  socket = null;
                  return;
                }
              }
              const qid: string | undefined = parsed?.queryId;
              if (!qid) return;
              const waiter = pending.get(qid);
              if (!waiter) return;
              if (t === 'error') {
                pending.delete(qid);
                waiter.reject(new Error(parsed?.error || 'Unknown error'));
              } else if (t === 'ok') {
                // Server acknowledged an arrow query with no result set
                pending.delete(qid);
                const empty = arrow.tableFromArrays(
                  {},
                ) as unknown as arrow.Table;
                waiter.resolve(empty);
              }
              return;
            }

            // Binary result: [4-byte BE header length][header JSON][Arrow bytes]
            let buffer: ArrayBuffer;
            if (event.data instanceof ArrayBuffer) buffer = event.data;
            else if (event.data instanceof Blob)
              buffer = await event.data.arrayBuffer();
            else return;

            const view = new DataView(buffer, 0, 4);
            const headerLen = view.getUint32(0, false);
            const headerStart = 4;
            const headerEnd = headerStart + headerLen;
            const headerBytes = new Uint8Array(
              buffer.slice(headerStart, headerEnd),
            );
            const headerStr = new TextDecoder().decode(headerBytes);
            let header: any;
            try {
              header = JSON.parse(headerStr);
            } catch {
              return;
            }
            const qid = header?.queryId as string | undefined;
            if (!qid) return;
            const waiter = pending.get(qid);
            if (!waiter) return;

            const arrowBytes = new Uint8Array(buffer.slice(headerEnd));
            try {
              const reader = await arrow.RecordBatchReader.from(arrowBytes);
              const batches: arrow.RecordBatch[] = [];
              for await (const batch of reader) batches.push(batch);
              const table = batches.length
                ? new arrow.Table(reader.schema, batches)
                : (arrow.tableFromArrays({}) as unknown as arrow.Table);
              pending.delete(qid);
              waiter.resolve(table);
            } catch (e) {
              pending.delete(qid);
              waiter.reject(e);
            }
          })();
        };

        ws.onerror = () => {
          if (opening) {
            opening = null;
            reject(new Error('WebSocket connection error'));
          } else {
            closeAndRejectAll('WebSocket error');
          }
          try {
            ws.close();
          } catch {}
        };

        ws.onclose = () => {
          if (opening) {
            opening = null;
            reject(new Error('WebSocket closed during open'));
          }
          closeAndRejectAll('WebSocket closed');
          socket = null;
        };
      } catch (e) {
        opening = null;
        reject(e);
      }
    });
    return opening;
  };

  const impl: BaseDuckDbConnectorImpl = {
    async initializeInternal() {
      await ensureSocket();
      // Subscribe on initialize, too (if socket was already open)
      resubscribe();
    },

    async destroyInternal() {
      try {
        socket?.close();
      } catch {}
      socket = null;
    },

    async executeQueryInternal<T extends arrow.TypeMap = any>(
      query: string,
      signal: AbortSignal,
      queryId?: string,
    ): Promise<arrow.Table<T>> {
      if (signal.aborted) {
        throw new DOMException('Query was cancelled', 'AbortError');
      }
      await ensureSocket();
      const qid =
        queryId || `q_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      return new Promise<arrow.Table<T>>((resolve, reject) => {
        const onAbort = () => {
          try {
            if (socket && socket.readyState === WebSocket.OPEN) {
              socket.send(JSON.stringify({type: 'cancel', queryId: qid}));
            }
          } catch (e) {
            console.error('Failed to send cancel message', qid, e);
          }
          pending.delete(qid);
          reject(new DOMException('Query was cancelled', 'AbortError'));
        };
        signal.addEventListener('abort', onAbort, {once: true});

        pending.set(qid, {
          resolve: (t) => {
            try {
              signal.removeEventListener('abort', onAbort);
            } catch (e) {
              console.error('Failed to remove abort listener', qid, e);
            }
            resolve(t as arrow.Table<T>);
          },
          reject: (e) => {
            try {
              signal.removeEventListener('abort', onAbort);
            } catch (e) {
              console.error('Failed to remove abort listener', qid, e);
            }
            reject(e);
          },
        });

        try {
          socket!.send(
            JSON.stringify({
              type: 'arrow',
              sql: query,
              queryId: qid,
            }),
          );
        } catch (e) {
          pending.delete(qid);
          try {
            signal.removeEventListener('abort', onAbort);
          } catch (e) {
            console.error('Failed to remove abort listener', qid, e);
          }
          reject(e);
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
    sendControlMessage: (message: any) => {
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        throw new Error('WebSocket not open');
      }
      console.log('sendControlMessage', message);
      socket.send(JSON.stringify(message));
    },
    addNotificationListener: (fn: (payload: any) => void) => {
      notificationListeners.add(fn);
    },
  };
}
