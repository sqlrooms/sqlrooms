import {
  BrowserBridgeServerMessage,
  MCP_BRIDGE_PROTOCOL_VERSION,
} from './protocol';
import type {RoomCapabilityRuntime} from './types';

type WebSocketEvent = {data?: unknown};
type WebSocketListener = (event: WebSocketEvent) => void;

type WebSocketLike = {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  addEventListener(
    type: 'open' | 'message' | 'close' | 'error',
    listener: WebSocketListener,
  ): void;
  removeEventListener(
    type: 'open' | 'message' | 'close' | 'error',
    listener: WebSocketListener,
  ): void;
};

export type RegisterBrowserMcpBridgeOptions = {
  url: string;
  token: string;
  pageId?: string;
  heartbeatMs?: number;
  reconnectMs?: number;
  createWebSocket?: (url: string) => WebSocketLike;
  onStatusChange?: (
    status: 'connecting' | 'ready' | 'disconnected' | 'error',
    error?: string,
  ) => void;
};

export type BrowserMcpBridge = {dispose: () => void};

type BridgeConnection = {
  socket: WebSocketLike;
  onOpen: WebSocketListener;
  onMessage: WebSocketListener;
  onClose: WebSocketListener;
  onError: WebSocketListener;
};

/**
 * Connects a browser capability runtime to the authenticated local MCP host.
 * Disposing it aborts active calls and prevents stale sockets from reconnecting.
 */
export function registerBrowserMcpBridge(
  runtime: RoomCapabilityRuntime,
  options: RegisterBrowserMcpBridgeOptions,
): BrowserMcpBridge {
  if (!options.token) throw new Error('MCP bridge token is required.');
  const createWebSocket =
    options.createWebSocket ?? ((url: string) => new WebSocket(url));
  const pageId = options.pageId ?? createPageId();
  const controllers = new Map<string, AbortController>();
  let connection: BridgeConnection | undefined;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  let disposed = false;

  const sendTo = (target: BridgeConnection, message: unknown) => {
    if (connection === target && target.socket.readyState === 1) {
      target.socket.send(JSON.stringify(message));
    }
  };

  const clearHeartbeat = () => {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = undefined;
  };

  const abortPending = () => {
    for (const controller of controllers.values()) controller.abort();
    controllers.clear();
  };

  const detach = (target: BridgeConnection) => {
    target.socket.removeEventListener('open', target.onOpen);
    target.socket.removeEventListener('message', target.onMessage);
    target.socket.removeEventListener('close', target.onClose);
    target.socket.removeEventListener('error', target.onError);
  };

  const handleMessage = async (target: BridgeConnection, raw: unknown) => {
    if (connection !== target) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(String(raw));
    } catch {
      return;
    }
    const validation = BrowserBridgeServerMessage.safeParse(parsed);
    if (!validation.success) return;
    const message = validation.data;
    if (message.type === 'bridge.authenticated') {
      sendTo(target, {
        version: MCP_BRIDGE_PROTOCOL_VERSION,
        type: 'bridge.ready',
        pageId,
      });
      clearHeartbeat();
      heartbeatTimer = setInterval(() => {
        sendTo(target, {
          version: MCP_BRIDGE_PROTOCOL_VERSION,
          type: 'bridge.heartbeat',
          pageId,
        });
      }, options.heartbeatMs ?? 10_000);
      options.onStatusChange?.('ready');
      return;
    }
    if (message.type === 'request.cancel') {
      controllers.get(message.requestId)?.abort();
      return;
    }
    if (message.type === 'bridge.error') {
      options.onStatusChange?.('error', message.message);
      return;
    }
    if (message.type !== 'bridge.request') return;

    const controller = new AbortController();
    controllers.set(message.requestId, controller);
    try {
      const result =
        message.method === 'tools.list'
          ? runtime.listTools()
          : await callRuntime(
              runtime,
              message.params,
              message.requestId,
              controller.signal,
            );
      sendTo(target, {
        version: MCP_BRIDGE_PROTOCOL_VERSION,
        type: 'bridge.response',
        pageId,
        requestId: message.requestId,
        ok: true,
        result,
      });
    } catch (error) {
      sendTo(target, {
        version: MCP_BRIDGE_PROTOCOL_VERSION,
        type: 'bridge.response',
        pageId,
        requestId: message.requestId,
        ok: false,
        error: {
          code: 'bridge_execution_error',
          message:
            error instanceof Error ? error.message : 'Bridge call failed.',
        },
      });
    } finally {
      if (controllers.get(message.requestId) === controller) {
        controllers.delete(message.requestId);
      }
    }
  };

  const connect = () => {
    if (disposed) return;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = undefined;
    options.onStatusChange?.('connecting');
    const socket = createWebSocket(options.url);
    const target: BridgeConnection = {
      socket,
      onOpen: () => {
        sendTo(target, {
          version: MCP_BRIDGE_PROTOCOL_VERSION,
          type: 'bridge.authenticate',
          pageId,
          token: options.token,
        });
      },
      onMessage: (event) => {
        void handleMessage(target, event.data);
      },
      onClose: () => {
        detach(target);
        if (connection !== target) return;
        connection = undefined;
        clearHeartbeat();
        abortPending();
        options.onStatusChange?.('disconnected');
        if (!disposed) {
          reconnectTimer = setTimeout(connect, options.reconnectMs ?? 1_000);
        }
      },
      onError: () => {
        if (connection === target) {
          options.onStatusChange?.('error', 'Bridge error.');
        }
      },
    };
    connection = target;
    socket.addEventListener('open', target.onOpen);
    socket.addEventListener('message', target.onMessage);
    socket.addEventListener('close', target.onClose);
    socket.addEventListener('error', target.onError);
  };

  connect();
  return {
    dispose: () => {
      if (disposed) return;
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = undefined;
      clearHeartbeat();
      const target = connection;
      if (target) {
        sendTo(target, {
          version: MCP_BRIDGE_PROTOCOL_VERSION,
          type: 'bridge.gone',
          pageId,
        });
      }
      abortPending();
      if (target) {
        detach(target);
        connection = undefined;
        target.socket.close(1000, 'page disposed');
      }
    },
  };
}

async function callRuntime(
  runtime: RoomCapabilityRuntime,
  rawParams: unknown,
  requestId: string,
  signal: AbortSignal,
) {
  const params = (rawParams ?? {}) as {
    name?: unknown;
    input?: unknown;
    context?: {
      clientInfo?: {name?: unknown; version?: unknown};
    };
  };
  if (typeof params.name !== 'string') {
    return {
      ok: false,
      code: 'invalid_input',
      message: 'Tool name is required.',
    };
  }
  const rawClientInfo = params.context?.clientInfo;
  const clientInfo = rawClientInfo
    ? {
        ...(typeof rawClientInfo.name === 'string'
          ? {name: rawClientInfo.name}
          : {}),
        ...(typeof rawClientInfo.version === 'string'
          ? {version: rawClientInfo.version}
          : {}),
      }
    : undefined;
  return runtime.callTool(params.name, params.input ?? {}, {
    surface: 'mcp-http',
    requestId,
    traceId: requestId,
    ...(clientInfo ? {clientInfo} : {}),
    metadata: {bridgeRequestId: requestId},
    signal,
  });
}

function createPageId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `page-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
