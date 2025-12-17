import {LoroDoc} from 'loro-crdt';
import {CrdtConnectionStatus, CrdtSyncConnector} from '../createCrdtSlice';

type WebSocketLike = {
  readyState: number;
  send: (data: string | ArrayBufferLike | Blob | ArrayBufferView) => void;
  close: () => void;
  addEventListener: (type: string, listener: (...args: any[]) => void) => void;
  removeEventListener: (
    type: string,
    listener: (...args: any[]) => void,
  ) => void;
};

const WS_OPEN = 1;
const WS_CONNECTING = 0;

const getOrCreateClientId = (storageKey: string) => {
  try {
    const ss = (globalThis as any).sessionStorage as Storage | undefined;
    if (ss) {
      const existing = ss.getItem(storageKey);
      if (existing) return existing;
      const created = (globalThis as any).crypto?.randomUUID?.() as
        | string
        | undefined;
      const id = created ?? `client-${Math.random().toString(16).slice(2)}`;
      ss.setItem(storageKey, id);
      return id;
    }
  } catch {
    // ignore
  }
  const created = (globalThis as any).crypto?.randomUUID?.() as
    | string
    | undefined;
  return created ?? `client-${Math.random().toString(16).slice(2)}`;
};

const toBase64 = (bytes: Uint8Array) => {
  const buf = (globalThis as any).Buffer as
    | {from: (input: Uint8Array) => {toString: (enc: string) => string}}
    | undefined;
  if (buf) {
    return buf.from(bytes).toString('base64');
  }
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
};

const fromBase64 = (value: string) => {
  const buf = (globalThis as any).Buffer as
    | {from: (input: string, encoding: string) => Uint8Array}
    | undefined;
  if (buf) {
    return Uint8Array.from(buf.from(value, 'base64'));
  }
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
};

export type WebSocketSyncOptions = {
  url: string;
  roomId: string;
  token?: string;
  params?: Record<string, string>;
  protocols?: string | string[];
  onStatus?: (status: Exclude<CrdtConnectionStatus, 'idle'>) => void;
  createSocket?: (url: string, protocols?: string | string[]) => WebSocketLike;
  sendSnapshotOnConnect?: boolean;
  /**
   * Optional per-tab client identifier. If omitted, the connector generates one via
   * `crypto.randomUUID()` and persists it in `sessionStorage` (per-tab) by default.
   */
  clientId?: string;
  /**
   * Storage key used for persisting the generated clientId in `sessionStorage`.
   *
   * @defaultValue `"sqlrooms-crdt-clientId"`
   */
  clientIdStorageKey?: string;
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
};

/**
 * Creates a CRDT sync connector that exchanges Loro updates over WebSocket.
 */
export function createWebSocketSyncConnector(
  options: WebSocketSyncOptions,
): CrdtSyncConnector {
  const sendSnapshotOnConnect = options.sendSnapshotOnConnect ?? true;
  const clientId =
    options.clientId ??
    getOrCreateClientId(
      options.clientIdStorageKey ?? `sqlrooms-crdt-clientId:${options.roomId}`,
    );
  let socket: WebSocketLike | undefined;
  let unsubscribeLocal: (() => void) | undefined;
  let subscribedDoc: LoroDoc | undefined;
  let attempt = 0;
  let stopped = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let joined = false;
  let snapshotApplied = false;
  let snapshotWaitTimer: ReturnType<typeof setTimeout> | undefined;
  let seededAfterEmptyServerSnapshot = false;
  let connecting = false;
  const pending: Uint8Array[] = [];
  let localSubscribed = false;
  let listeningSocket: WebSocketLike | undefined;
  let detachSocketListeners: (() => void) | undefined;
  let statusListener:
    | ((status: Exclude<CrdtConnectionStatus, 'idle'>) => void)
    | undefined;

  const maxRetries = options.maxRetries ?? Infinity;
  const initialDelay = options.initialDelayMs ?? 500;
  const maxDelay = options.maxDelayMs ?? 5000;

  const maybeSendUpdate = (update: Uint8Array) => {
    if (!socket || socket.readyState !== WS_OPEN) {
      pending.push(update);
      return;
    }
    if (!joined) {
      pending.push(update);
      return;
    }
    // IMPORTANT: don't send local updates until we've applied the server snapshot.
    // Otherwise, a refreshing client that starts with empty local state can emit delete ops
    // that wipe the room before the snapshot arrives.
    if (!snapshotApplied) {
      pending.push(update);
      return;
    }
    socket.send(update);
  };

  const attachLocalSubscription = (doc: LoroDoc) => {
    try {
      const unsub = doc.subscribeLocalUpdates((update: Uint8Array) => {
        // Pass through to shared handler so we keep centralized buffering/sending logic.
        maybeSendUpdate(update);
      });
      unsubscribeLocal = () => {
        try {
          unsub();
        } catch (error) {
          console.warn('[crdt] failed to unsubscribe local updates', error);
        }
      };
      localSubscribed = true;
    } catch (error) {
      console.warn('[crdt] failed to attach local subscription', error);
      localSubscribed = false;
      unsubscribeLocal = undefined;
    }
  };

  /**
   * Ensures we are subscribed to local updates on the *current* doc.
   *
   * This matters because this connector can be reused across reconnects and
   * `connect(doc)` calls; we must not keep a stale subscription to a prior doc.
   */
  const ensureLocalSubscription = (doc: LoroDoc) => {
    if (subscribedDoc && subscribedDoc !== doc) {
      unsubscribeLocal?.();
      unsubscribeLocal = undefined;
      localSubscribed = false;
      subscribedDoc = undefined;
    }
    if (!localSubscribed || !unsubscribeLocal || subscribedDoc !== doc) {
      attachLocalSubscription(doc);
      subscribedDoc = doc;
    }
  };

  const buildUrl = () => {
    const url = new URL(options.url);
    url.searchParams.set('roomId', options.roomId);
    if (options.token) url.searchParams.set('token', options.token);
    if (options.params) {
      Object.entries(options.params).forEach(([k, v]) =>
        url.searchParams.set(k, v),
      );
    }
    return url.toString();
  };

  const sendStatus = (status: Exclude<CrdtConnectionStatus, 'idle'>) => {
    options.onStatus?.(status);
    statusListener?.(status);
  };

  const sendJoin = () => {
    if (!socket || socket.readyState !== WS_OPEN) return;
    const payload = JSON.stringify({
      type: 'crdt-join',
      roomId: options.roomId,
      clientId,
    });
    socket.send(payload);
  };

  const sendSnapshot = (doc: LoroDoc) => {
    if (!socket || socket.readyState !== WS_OPEN) return;
    try {
      const snapshot = doc.export({mode: 'snapshot'});
      const payload = JSON.stringify({
        type: 'crdt-snapshot',
        roomId: options.roomId,
        data: toBase64(snapshot),
      });
      socket.send(payload);
    } catch (error) {
      console.warn('Failed to send CRDT snapshot', error);
    }
  };

  const scheduleReconnect = (doc: LoroDoc) => {
    if (stopped) return;
    if (reconnectTimer) return;
    if (connecting) return;
    if (attempt >= maxRetries) {
      sendStatus('closed');
      return;
    }
    const delay = Math.min(maxDelay, initialDelay * 2 ** attempt);
    attempt += 1;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = undefined;
      void connect(doc);
    }, delay);
    // Avoid keeping the Node.js event loop alive in tests/SSR environments.
    // No-op in browsers.
    (reconnectTimer as any)?.unref?.();
  };

  const getEmptySnapshotLen = () => {
    try {
      return new LoroDoc().export({mode: 'snapshot'}).byteLength;
    } catch {
      return 0;
    }
  };

  const connect = async (doc: LoroDoc) => {
    if (stopped) return;
    if (connecting) return;
    // Always ensure we are subscribed to the *current* doc.
    ensureLocalSubscription(doc);

    const attachSocketListenersFor = (ws: WebSocketLike) => {
      // Ensure browser websockets deliver binary frames as ArrayBuffer (not Blob)
      if ('binaryType' in ws) {
        try {
          (ws as any).binaryType = 'arraybuffer';
        } catch (error) {
          console.warn('Failed to set binaryType on CRDT websocket', error);
        }
      }

      const handleMessage = (event: any) => {
        // Use the currently connected doc reference (not the doc that created the socket),
        // so a later connect(doc) call can rebind without needing a new WebSocket.
        const activeDoc = subscribedDoc ?? doc;
        if (!activeDoc) return;
        // Binary updates flow directly
        if (
          event.data instanceof ArrayBuffer ||
          ArrayBuffer.isView(event.data)
        ) {
          const bytes =
            event.data instanceof ArrayBuffer
              ? new Uint8Array(event.data)
              : new Uint8Array(
                  event.data.buffer,
                  event.data.byteOffset,
                  event.data.byteLength,
                );
          activeDoc.import(bytes);
          return;
        }
        if (typeof Blob !== 'undefined' && event.data instanceof Blob) {
          void event.data
            .arrayBuffer()
            .then((buf: ArrayBuffer) => {
              const bytes = new Uint8Array(buf);
              activeDoc.import(bytes);
            })
            .catch((error: unknown) =>
              console.warn('Failed to decode CRDT binary message', error),
            );
          return;
        }

        if (typeof event.data === 'string') {
          try {
            const parsed = JSON.parse(event.data);
            if (parsed?.type === 'crdt-joined') {
              joined = true;
              snapshotApplied = false;
              // IMPORTANT: do not flush buffered local updates yet.
              // The server sends `crdt-joined` before `crdt-snapshot`; flushing here can
              // broadcast "empty state" ops from a refreshing client and wipe the room.
              if (snapshotWaitTimer) clearTimeout(snapshotWaitTimer);
              snapshotWaitTimer = setTimeout(() => {
                snapshotWaitTimer = undefined;
                if (!ws || ws.readyState !== WS_OPEN) return;
                // Fallback: if we never get a snapshot, avoid buffering forever.
                snapshotApplied = true;
                while (pending.length) {
                  const update = pending.shift();
                  if (update) ws.send(update);
                }
              }, 2000);
              (snapshotWaitTimer as any)?.unref?.();
              return;
            }
            if (parsed?.type === 'crdt-snapshot' && parsed.data) {
              const bytes = fromBase64(parsed.data);
              // If the server snapshot is empty, but we already have non-empty local state,
              // don't import the empty snapshot (it would wipe local state). Instead, seed
              // the server once with our snapshot.
              try {
                const emptyLen = getEmptySnapshotLen();
                const serverLooksEmpty = bytes.byteLength <= emptyLen + 32;
                const localSnapshotLen = activeDoc.export({
                  mode: 'snapshot',
                }).byteLength;
                const localNonEmpty = localSnapshotLen > emptyLen + 32;
                if (
                  serverLooksEmpty &&
                  localNonEmpty &&
                  !seededAfterEmptyServerSnapshot &&
                  ws &&
                  ws.readyState === WS_OPEN
                ) {
                  seededAfterEmptyServerSnapshot = true;
                  // Seed the server; server will accept snapshot only if the room is empty.
                  sendSnapshot(activeDoc);
                  snapshotApplied = true;
                  if (snapshotWaitTimer) {
                    clearTimeout(snapshotWaitTimer);
                    snapshotWaitTimer = undefined;
                  }
                  return;
                }
              } catch {
                // ignore
              }

              activeDoc.import(bytes);
              snapshotApplied = true;
              if (snapshotWaitTimer) {
                clearTimeout(snapshotWaitTimer);
                snapshotWaitTimer = undefined;
              }
              // Now that we have base state, flush any local updates buffered during join.
              while (pending.length) {
                const update = pending.shift();
                if (update && ws && ws.readyState === WS_OPEN) {
                  ws.send(update);
                }
              }
            }
            // Ignore other messages (errors, acks) for now
          } catch (error) {
            console.warn('Failed to parse CRDT message', error);
          }
        }
      };

      const handleOpen = () => {
        attempt = 0;
        joined = false;
        snapshotApplied = false;
        seededAfterEmptyServerSnapshot = false;
        if (snapshotWaitTimer) {
          clearTimeout(snapshotWaitTimer);
          snapshotWaitTimer = undefined;
        }
        connecting = false;
        sendStatus('open');
        sendJoin();
        if (sendSnapshotOnConnect) {
          sendSnapshot(doc);
        }
        ensureLocalSubscription(doc);
      };

      const handleClose = (event: CloseEvent) => {
        console.warn('CRDT WS closed', {
          code: event.code,
          reason: event.reason,
          pending: pending.length,
          joined,
        });
        connecting = false;
        sendStatus('closed');
        if (snapshotWaitTimer) {
          clearTimeout(snapshotWaitTimer);
          snapshotWaitTimer = undefined;
        }
        unsubscribeLocal?.();
        unsubscribeLocal = undefined;
        localSubscribed = false;
        subscribedDoc = undefined;
        joined = false;
        pending.length = 0;
        detachSocketListeners?.();
        detachSocketListeners = undefined;
        listeningSocket = undefined;
        scheduleReconnect(doc);
      };

      const handleError = (event: Event) => {
        console.warn('CRDT WS error', event);
        connecting = false;
        sendStatus('error');
        if (snapshotWaitTimer) {
          clearTimeout(snapshotWaitTimer);
          snapshotWaitTimer = undefined;
        }
        joined = false;
        unsubscribeLocal?.();
        unsubscribeLocal = undefined;
        localSubscribed = false;
        subscribedDoc = undefined;
        detachSocketListeners?.();
        detachSocketListeners = undefined;
        listeningSocket = undefined;
        scheduleReconnect(doc);
      };

      // Some WebSocket implementations expose either addEventListener or on*
      // handlers. Use one style only to avoid duplicate events.
      if (typeof ws.addEventListener === 'function') {
        ws.addEventListener('message', handleMessage);
        ws.addEventListener('open', handleOpen);
        ws.addEventListener('close', handleClose);
        ws.addEventListener('error', handleError);
        detachSocketListeners = () => {
          try {
            ws.removeEventListener('message', handleMessage);
            ws.removeEventListener('open', handleOpen);
            ws.removeEventListener('close', handleClose);
            ws.removeEventListener('error', handleError);
          } catch (error) {
            console.warn('[crdt] failed to detach socket listeners', error);
          }
        };
      } else {
        (ws as any).onmessage = handleMessage;
        (ws as any).onopen = handleOpen;
        (ws as any).onclose = handleClose;
        (ws as any).onerror = handleError;
        detachSocketListeners = () => {
          try {
            (ws as any).onmessage = null;
            (ws as any).onopen = null;
            (ws as any).onclose = null;
            (ws as any).onerror = null;
          } catch (error) {
            console.warn('[crdt] failed to clear socket handlers', error);
          }
        };
      }
      listeningSocket = ws;

      // If we stay in CONNECTING too long, force a reconnect to avoid being stuck.
      const connectingTimeout = setTimeout(() => {
        if (ws && ws.readyState === WS_CONNECTING && !joined) {
          console.warn('[crdt] ws still connecting after timeout; retrying');
          try {
            ws.close();
          } catch (error) {
            console.warn('[crdt] error closing stuck socket', error);
          }
        }
      }, 3000);
      // Avoid keeping the Node.js event loop alive in tests/SSR environments.
      // No-op in browsers.
      (connectingTimeout as any)?.unref?.();
    };

    if (
      socket &&
      (socket.readyState === WS_OPEN || socket.readyState === WS_CONNECTING)
    ) {
      if (listeningSocket !== socket) {
        console.warn('[crdt] existing socket had no listeners; attaching now');
        attachSocketListenersFor(socket);
        // If the socket is already open, we won't get an 'open' event, so act as if
        // we just opened: (re)join and optionally send snapshot.
        if (socket.readyState === WS_OPEN) {
          attempt = 0;
          joined = false;
          sendStatus('open');
          sendJoin();
          if (sendSnapshotOnConnect) sendSnapshot(doc);
        }
      }
      return;
    }
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = undefined;
    }
    connecting = true;
    sendStatus('connecting');
    const wsCreator =
      options.createSocket ??
      ((url, protocols) => new WebSocket(url, protocols));
    const url = buildUrl();
    try {
      socket = wsCreator(url, options.protocols);
    } catch (error) {
      connecting = false;
      sendStatus('error');
      scheduleReconnect(doc);
      return;
    }
    attachSocketListenersFor(socket);
  };

  const disconnect = async () => {
    stopped = true;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = undefined;
    }
    unsubscribeLocal?.();
    unsubscribeLocal = undefined;
    localSubscribed = false;
    subscribedDoc = undefined;
    detachSocketListeners?.();
    detachSocketListeners = undefined;
    listeningSocket = undefined;
    if (socket) {
      try {
        socket.close();
      } catch (error) {
        console.warn('Error closing CRDT websocket', error);
      }
    }
    socket = undefined;
    sendStatus('closed');
  };

  return {
    connect,
    disconnect,
    setStatusListener: (listener) => {
      statusListener = listener as any;
    },
  };
}
