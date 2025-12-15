import {LoroDoc} from 'loro-crdt';
import {CrdtSyncConnector} from '../createCrdtSlice';

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
  onStatus?: (status: 'connecting' | 'open' | 'closed' | 'error') => void;
  createSocket?: (url: string, protocols?: string | string[]) => WebSocketLike;
  sendSnapshotOnConnect?: boolean;
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
  let socket: WebSocketLike | undefined;
  let unsubscribeLocal: (() => void) | undefined;
  let attempt = 0;
  let stopped = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let joined = false;
  let connecting = false;
  const pending: Uint8Array[] = [];
  let localSubscribed = false;

  const maxRetries = options.maxRetries ?? Infinity;
  const initialDelay = options.initialDelayMs ?? 500;
  const maxDelay = options.maxDelayMs ?? 5000;

  const maybeSendUpdate = (update: Uint8Array) => {
    console.debug('[crdt] local update observed', update.byteLength, 'bytes', {
      joined,
      readyState: socket?.readyState,
    });
    if (!socket || socket.readyState !== WS_OPEN) {
      console.debug('[crdt] skip send: socket not open, buffering');
      pending.push(update);
      return;
    }
    if (!joined) {
      console.debug(
        '[crdt] buffering local update before join',
        update.byteLength,
        'bytes',
      );
      pending.push(update);
      return;
    }
    console.debug('[crdt] sending local update', update.byteLength, 'bytes');
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
      console.debug('[crdt] attached local update subscription');
    } catch (error) {
      console.warn('[crdt] failed to attach local subscription', error);
      localSubscribed = false;
      unsubscribeLocal = undefined;
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

  const sendStatus = (status: 'connecting' | 'open' | 'closed' | 'error') => {
    console.info('[crdt] ws status ->', status);
    options.onStatus?.(status);
  };

  const sendJoin = () => {
    if (!socket || socket.readyState !== WS_OPEN) return;
    const payload = JSON.stringify({type: 'crdt-join', roomId: options.roomId});
    console.debug('[crdt] sending join', payload);
    socket.send(payload);
  };

  const sendSnapshot = (doc: LoroDoc) => {
    if (!socket || socket.readyState !== WS_OPEN) return;
    try {
      const snapshot = doc.export({mode: 'snapshot'});
      console.info(
        '[crdt] sending snapshot bytes',
        snapshot?.byteLength ?? snapshot?.length ?? 0,
      );
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
  };

  const connect = async (doc: LoroDoc) => {
    if (stopped) return;
    if (connecting) return;
    // Always (re)attach; if an earlier attempt failed, retry now.
    if (!localSubscribed) {
      attachLocalSubscription(doc);
    }
    console.info('[crdt] connect start');
    if (
      socket &&
      (socket.readyState === WS_OPEN || socket.readyState === WS_CONNECTING)
    ) {
      console.info(
        '[crdt] reuse existing socket, readyState:',
        socket.readyState,
      );
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
      console.info('[crdt] ws created', url);
    } catch (error) {
      connecting = false;
      sendStatus('error');
      scheduleReconnect(doc);
      return;
    }
    // Ensure browser websockets deliver binary frames as ArrayBuffer (not Blob)
    if ('binaryType' in socket) {
      try {
        (socket as any).binaryType = 'arraybuffer';
      } catch (error) {
        console.warn('Failed to set binaryType on CRDT websocket', error);
      }
    }

    const handleMessage = (event: any) => {
      if (!doc) return;
      // Binary updates flow directly
      if (event.data instanceof ArrayBuffer || ArrayBuffer.isView(event.data)) {
        const bytes =
          event.data instanceof ArrayBuffer
            ? new Uint8Array(event.data)
            : new Uint8Array(
                event.data.buffer,
                event.data.byteOffset,
                event.data.byteLength,
              );
        doc.import(bytes);
        return;
      }
      if (typeof Blob !== 'undefined' && event.data instanceof Blob) {
        void event.data
          .arrayBuffer()
          .then((buf: ArrayBuffer) => doc.import(new Uint8Array(buf)))
          .catch((error: unknown) =>
            console.warn('Failed to decode CRDT binary message', error),
          );
        return;
      }

      if (typeof event.data === 'string') {
        try {
          const parsed = JSON.parse(event.data);
          console.debug('[crdt] ws message', parsed?.type);
          if (parsed?.type === 'crdt-joined') {
            joined = true;
            console.debug(
              '[crdt] joined room, flushing',
              pending.length,
              'pending',
            );
            // flush pending updates
            while (pending.length) {
              const update = pending.shift();
              if (update && socket && socket.readyState === WS_OPEN) {
                // Debug visibility for diagnosing silent sync issues.
                console.debug(
                  '[crdt] sending pending update after join',
                  update.byteLength,
                  'bytes',
                );
                socket.send(update);
              }
            }
            return;
          }
          if (parsed?.type === 'crdt-snapshot' && parsed.data) {
            const bytes = fromBase64(parsed.data);
            doc.import(bytes);
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
      connecting = false;
      sendStatus('open');
      sendJoin();
      if (options.sendSnapshotOnConnect) {
        sendSnapshot(doc);
      }
      attachLocalSubscription(doc);
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
      unsubscribeLocal?.();
      unsubscribeLocal = undefined;
      localSubscribed = false;
      joined = false;
      pending.length = 0;
      scheduleReconnect(doc);
    };

    const handleError = (event: Event) => {
      console.warn('CRDT WS error', event);
      connecting = false;
      sendStatus('error');
      joined = false;
      unsubscribeLocal?.();
      unsubscribeLocal = undefined;
      localSubscribed = false;
      scheduleReconnect(doc);
    };

    // Some WebSocket implementations expose either addEventListener or on*
    // handlers. Use one style only to avoid duplicate events.
    if (typeof socket.addEventListener === 'function') {
      socket.addEventListener('message', handleMessage);
      socket.addEventListener('open', handleOpen);
      socket.addEventListener('close', handleClose);
      socket.addEventListener('error', handleError);
    } else {
      (socket as any).onmessage = handleMessage;
      (socket as any).onopen = handleOpen;
      (socket as any).onclose = handleClose;
      (socket as any).onerror = handleError;
    }

    // If we stay in CONNECTING too long, force a reconnect to avoid being stuck.
    setTimeout(() => {
      if (socket && socket.readyState === WS_CONNECTING && !joined) {
        console.warn('[crdt] ws still connecting after timeout; retrying');
        try {
          socket.close();
        } catch (error) {
          console.warn('[crdt] error closing stuck socket', error);
        }
      }
    }, 3000);
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

  return {connect, disconnect};
}
