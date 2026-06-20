import {
  QueryRequest,
  RuntimeMessage,
  createRuntimeDiagnostic,
  createRuntimeErrorResponse,
  createRuntimeResponse,
  type AppCapability,
  type AppDiagnostic,
  type QueryResult,
  type RuntimeErrorPayload,
  type RuntimeRequestMessage,
} from './protocol';

export type AppRuntimeHost = {
  reportDiagnostic: (diagnostic: AppDiagnostic) => void;
  dispose: () => void;
};

export type AppRuntimeHostHandlers = {
  query?: (request: QueryRequest) => Promise<QueryResult> | QueryResult;
  schema?: () => Promise<unknown> | unknown;
};

export type CreateBridgeHostOptions = {
  targetWindow: Window;
  currentWindow?: Window;
  targetOrigin?: string;
  capabilities?: Partial<Record<AppCapability, boolean>>;
  handlers?: AppRuntimeHostHandlers;
  onDiagnostic?: (diagnostic: AppDiagnostic) => void;
};

const METHOD_CAPABILITY: Record<string, AppCapability> = {
  query: 'query',
  schema: 'schema',
};

export function createBridgeHost({
  targetWindow,
  currentWindow = window,
  targetOrigin = '*',
  capabilities = {},
  handlers = {},
  onDiagnostic,
}: CreateBridgeHostOptions): AppRuntimeHost {
  const send = (message: unknown) => {
    targetWindow.postMessage(message, targetOrigin);
  };

  const sendError = (id: string, error: RuntimeErrorPayload) => {
    send(createRuntimeErrorResponse(id, error));
  };

  const handleRequest = async (message: RuntimeRequestMessage) => {
    const capability = METHOD_CAPABILITY[message.method];
    if (!capability || !capabilities[capability]) {
      sendError(message.id, {
        code: capability ? 'capability_denied' : 'method_not_found',
        message: capability
          ? `Capability "${capability}" is not granted.`
          : `Unknown runtime method "${message.method}".`,
      });
      return;
    }

    try {
      switch (message.method) {
        case 'query': {
          if (!handlers.query) {
            sendError(message.id, {
              code: 'method_not_found',
              message: 'No query handler is registered.',
            });
            return;
          }
          const request = QueryRequest.parse(message.payload);
          const result = await handlers.query(request);
          send(createRuntimeResponse(message.id, result));
          return;
        }
        case 'schema': {
          if (!handlers.schema) {
            sendError(message.id, {
              code: 'method_not_found',
              message: 'No schema handler is registered.',
            });
            return;
          }
          const result = await handlers.schema();
          send(createRuntimeResponse(message.id, result));
          return;
        }
      }
    } catch (error) {
      const runtimeError = toRuntimeError(error, message);
      sendError(message.id, runtimeError);
      onDiagnostic?.({
        level: 'error',
        source: message.method === 'query' ? 'query' : 'runtime',
        message: runtimeError.message,
        detail: runtimeError.detail,
        timestamp: Date.now(),
      });
    }
  };

  const handleMessage = (event: MessageEvent) => {
    if (event.source !== targetWindow) return;
    const parsed = RuntimeMessage.safeParse(event.data);
    if (!parsed.success) return;
    const message = parsed.data;
    if (message.direction === 'request') {
      void handleRequest(message);
      return;
    }
    if (message.direction === 'diagnostic') {
      onDiagnostic?.({
        ...message.diagnostic,
        timestamp: message.diagnostic.timestamp ?? Date.now(),
      });
    }
  };

  currentWindow.addEventListener('message', handleMessage);

  return {
    reportDiagnostic(diagnostic) {
      send(
        createRuntimeDiagnostic({
          ...diagnostic,
          timestamp: diagnostic.timestamp ?? Date.now(),
        }),
      );
    },
    dispose() {
      currentWindow.removeEventListener('message', handleMessage);
    },
  };
}

function toRuntimeError(
  error: unknown,
  message: RuntimeRequestMessage,
): RuntimeErrorPayload {
  if (error instanceof Error) {
    return {
      code: message.method === 'query' ? 'query_failed' : 'invalid_request',
      message: error.message,
      sql: getSql(message.payload),
      detail: error.stack,
    };
  }
  return {
    code: message.method === 'query' ? 'query_failed' : 'invalid_request',
    message: String(error),
    sql: getSql(message.payload),
  };
}

function getSql(payload: unknown) {
  const parsed = QueryRequest.safeParse(payload);
  return parsed.success ? parsed.data.sql : undefined;
}
