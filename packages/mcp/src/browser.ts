import {
  BrowserBridgeServerMessage,
  MCP_BRIDGE_PROTOCOL_VERSION,
} from './protocol';
import type {RoomCapabilityContext, RoomCapabilityRuntime} from './types';

type WebSocketLike = {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  addEventListener(
    type: 'open' | 'message' | 'close' | 'error',
    listener: (event: any) => void,
  ): void;
  removeEventListener(
    type: 'open' | 'message' | 'close' | 'error',
    listener: (event: any) => void,
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

export function registerBrowserMcpBridge(
  runtime: RoomCapabilityRuntime,
  options: RegisterBrowserMcpBridgeOptions,
): BrowserMcpBridge {
  const createWebSocket =
    options.createWebSocket ?? ((url: string) => new WebSocket(url));
  const pageId = options.pageId ?? createPageId();
  const controllers = new Map<string, AbortController>();
  let socket: WebSocketLike | undefined;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  let disposed = false;

  const send = (message: unknown) => {
    if (socket?.readyState === 1) socket.send(JSON.stringify(message));
  };

  const connect = () => {
    if (disposed) return;
    options.onStatusChange?.('connecting');
    socket = createWebSocket(options.url);

    const onOpen = () => {
      send({
        version: MCP_BRIDGE_PROTOCOL_VERSION,
        type: 'bridge.authenticate',
        pageId,
        token: options.token,
      });
    };
    const onMessage = (event: {data?: unknown}) => {
      void handleMessage(event.data);
    };
    const onClose = () => {
      clearHeartbeat();
      abortPending();
      options.onStatusChange?.('disconnected');
      if (!disposed) {
        reconnectTimer = setTimeout(connect, options.reconnectMs ?? 1_000);
      }
    };
    const onError = () => options.onStatusChange?.('error', 'Bridge error.');

    socket.addEventListener('open', onOpen);
    socket.addEventListener('message', onMessage);
    socket.addEventListener('close', onClose);
    socket.addEventListener('error', onError);
  };

  const handleMessage = async (raw: unknown) => {
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
      send({
        version: MCP_BRIDGE_PROTOCOL_VERSION,
        type: 'bridge.ready',
        pageId,
      });
      heartbeatTimer = setInterval(() => {
        send({
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
      send({
        version: MCP_BRIDGE_PROTOCOL_VERSION,
        type: 'bridge.response',
        pageId,
        requestId: message.requestId,
        ok: true,
        result,
      });
    } catch (error) {
      send({
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
      controllers.delete(message.requestId);
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

  connect();
  return {
    dispose: () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      clearHeartbeat();
      abortPending();
      send({
        version: MCP_BRIDGE_PROTOCOL_VERSION,
        type: 'bridge.gone',
        pageId,
      });
      socket?.close(1000, 'page disposed');
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
    context?: Partial<RoomCapabilityContext>;
  };
  if (typeof params.name !== 'string') {
    return {
      ok: false,
      code: 'invalid_input',
      message: 'Tool name is required.',
    };
  }
  const suppliedContext = params.context ?? {};
  return runtime.callTool(params.name, params.input ?? {}, {
    ...suppliedContext,
    surface: suppliedContext.surface ?? 'mcp-http',
    requestId: suppliedContext.requestId ?? requestId,
    metadata: {
      ...(suppliedContext.metadata ?? {}),
      bridgeRequestId: requestId,
    },
    signal,
  });
}

function createPageId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `page-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
