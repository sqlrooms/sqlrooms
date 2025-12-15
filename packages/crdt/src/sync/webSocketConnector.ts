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

  const maxRetries = options.maxRetries ?? Infinity;
  const initialDelay = options.initialDelayMs ?? 500;
  const maxDelay = options.maxDelayMs ?? 5000;

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
    options.onStatus?.(status);
  };

  const sendJoin = () => {
    if (!socket || socket.readyState !== WS_OPEN) return;
    const payload = JSON.stringify({type: 'crdt-join', roomId: options.roomId});
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
  };

  const connect = async (doc: LoroDoc) => {
    if (stopped) return;
    if (connecting) return;
    if (
      socket &&
      (socket.readyState === WS_OPEN || socket.readyState === WS_CONNECTING)
    ) {
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
    try {
      socket = wsCreator(buildUrl(), options.protocols);
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
          if (parsed?.type === 'crdt-joined') {
            joined = true;
            // flush pending updates
            while (pending.length) {
              const update = pending.shift();
              if (update && socket && socket.readyState === WS_OPEN) {
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
      unsubscribeLocal = doc.subscribeLocalUpdates((update: Uint8Array) => {
        if (!socket || socket.readyState !== WS_OPEN) return;
        if (!joined) {
          pending.push(update);
          return;
        }
        socket.send(update);
      });
    };

    const handleClose = () => {
      connecting = false;
      sendStatus('closed');
      unsubscribeLocal?.();
      unsubscribeLocal = undefined;
      joined = false;
      pending.length = 0;
      scheduleReconnect(doc);
    };

    const handleError = () => {
      connecting = false;
      sendStatus('error');
      joined = false;
      scheduleReconnect(doc);
    };

    socket.addEventListener('message', handleMessage);
    socket.addEventListener('open', handleOpen);
    socket.addEventListener('close', handleClose);
    socket.addEventListener('error', handleError);
  };

  const disconnect = async () => {
    stopped = true;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = undefined;
    }
    unsubscribeLocal?.();
    unsubscribeLocal = undefined;
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
