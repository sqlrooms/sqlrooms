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

export type CreateDiagnosticPreludeScriptOptions = {
  targetOrigin?: string;
  globalName?: string;
  requestTimeoutMs?: number;
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
          const parsedRequest = QueryRequest.safeParse(message.payload);
          if (!parsedRequest.success) {
            sendError(message.id, {
              code: 'invalid_request',
              message: 'Invalid query request payload.',
              detail: parsedRequest.error.flatten(),
            });
            return;
          }
          const request = parsedRequest.data;
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
      onDiagnostic?.(
        sanitizeDiagnostic({
          ...message.diagnostic,
          timestamp: message.diagnostic.timestamp ?? Date.now(),
        }),
      );
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

export function createDiagnosticPreludeScript({
  targetOrigin = '*',
  globalName = 'sqlrooms',
  requestTimeoutMs = 15_000,
}: CreateDiagnosticPreludeScriptOptions = {}): string {
  return `
(() => {
  const MESSAGE_TYPE = 'sqlrooms.app-runtime.message';
  const PROTOCOL_VERSION = 1;
  const TARGET_ORIGIN = ${JSON.stringify(targetOrigin)};
  const GLOBAL_NAME = ${JSON.stringify(globalName)};
  const REQUEST_TIMEOUT_MS = ${JSON.stringify(requestTimeoutMs)};
  let nextId = 0;
  const pending = new Map();

  function post(message) {
    window.parent.postMessage(message, TARGET_ORIGIN);
  }

  function diagnostic(level, source, message, detail) {
    const sanitizedDetail = serializeDiagnosticDetail(detail);
    post({
      type: MESSAGE_TYPE,
      version: PROTOCOL_VERSION,
      direction: 'diagnostic',
      diagnostic: {
        level,
        source,
        message: String(message || ''),
        detail: sanitizedDetail,
        timestamp: Date.now(),
      },
    });
  }

  function formatConsoleArgument(value) {
    if (value instanceof Error) {
      return value.name + ': ' + value.message;
    }
    if (typeof value === 'string') return value;
    if (typeof value === 'bigint') return value.toString() + 'n';
    try {
      const serialized = JSON.stringify(serializeDiagnosticDetail(value));
      return serialized === undefined ? String(value) : serialized;
    } catch {
      return String(value);
    }
  }

  function serializeDiagnosticDetail(value, depth = 0, seen = new WeakSet()) {
    if (value == null) return value;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'bigint') return value.toString() + 'n';
    if (typeof value === 'symbol') return value.toString();
    if (typeof value === 'function') return '[Function ' + (value.name || 'anonymous') + ']';
    if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message,
        stack: value.stack,
      };
    }
    if (typeof Element !== 'undefined' && value instanceof Element) {
      return {
        tagName: value.tagName,
        id: value.id || undefined,
        className: typeof value.className === 'string' ? value.className : undefined,
      };
    }
    if (typeof value !== 'object') return String(value);
    if (seen.has(value)) return '[Circular]';
    if (depth >= 4) return '[Object]';
    seen.add(value);
    if (Array.isArray(value)) {
      return value.map((entry) => serializeDiagnosticDetail(entry, depth + 1, seen));
    }
    const result = {};
    for (const key of Object.keys(value)) {
      result[key] = serializeDiagnosticDetail(value[key], depth + 1, seen);
    }
    return result;
  }

  function request(method, payload) {
    const id = 'html-app:' + Date.now().toString(36) + ':' + nextId++;
    const response = new Promise((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        pending.delete(id);
        reject(new Error('Runtime request "' + method + '" timed out.'));
      }, REQUEST_TIMEOUT_MS);
      pending.set(id, {resolve, reject, timeoutId});
    });
    post({
      type: MESSAGE_TYPE,
      version: PROTOCOL_VERSION,
      direction: 'request',
      id,
      method,
      payload,
    });
    return response;
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window.parent) return;
    const data = event.data;
    if (!data || data.type !== MESSAGE_TYPE || data.direction !== 'response') {
      return;
    }
    const pendingRequest = pending.get(data.id);
    if (!pendingRequest) return;
    pending.delete(data.id);
    window.clearTimeout(pendingRequest.timeoutId);
    if (data.ok) {
      pendingRequest.resolve(data.payload);
    } else {
      const error = new Error(data.error?.message || 'Runtime request failed.');
      error.code = data.error?.code;
      error.detail = data.error?.detail;
      pendingRequest.reject(error);
    }
  });

  window[GLOBAL_NAME] = {
    query(sql, options = {}) {
      return request('query', {...options, sql});
    },
    async queryRows(sql, options = {}) {
      const result = await this.query(sql, options);
      return result.rows || [];
    },
    reportDiagnostic: (entry) => diagnostic(
      entry?.level || 'info',
      entry?.source || 'runtime',
      entry?.message || '',
      entry?.detail,
    ),
  };

  const originalWarn = console.warn.bind(console);
  console.warn = (...args) => {
    diagnostic('warn', 'console', args.map(formatConsoleArgument).join(' '), args);
    originalWarn(...args);
  };
  const originalError = console.error.bind(console);
  console.error = (...args) => {
    diagnostic('error', 'console', args.map(formatConsoleArgument).join(' '), args);
    originalError(...args);
  };
  window.addEventListener('error', (event) => {
    const target = event.target;
    const resourceUrl = target && target !== window
      ? target.src || target.href || ''
      : '';
    if (resourceUrl) {
      diagnostic('error', 'resource', resourceUrl || 'Resource failed to load');
      return;
    }
    diagnostic('error', 'runtime', event.message, {
      file: event.filename,
      line: event.lineno,
      column: event.colno,
      stack: event.error?.stack,
    });
  }, true);
  window.addEventListener('unhandledrejection', (event) => {
    diagnostic('error', 'promise', event.reason?.message || event.reason, {
      stack: event.reason?.stack,
    });
  });
  window.addEventListener('securitypolicyviolation', (event) => {
    const blockedUri = event.blockedURI || 'inline';
    const directive = event.violatedDirective || event.effectiveDirective || 'unknown directive';
    diagnostic(
      'warn',
      'resource',
      'Content Security Policy blocked ' + blockedUri + ' for ' + directive + '.',
      {
        blockedURI: blockedUri,
        violatedDirective: event.violatedDirective,
        effectiveDirective: event.effectiveDirective,
        originalPolicy: event.originalPolicy,
        sourceFile: event.sourceFile,
        lineNumber: event.lineNumber,
        columnNumber: event.columnNumber,
      },
    );
  });
})();
`;
}

function sanitizeDiagnostic(diagnostic: AppDiagnostic): AppDiagnostic {
  return {
    ...diagnostic,
    detail: sanitizeDiagnosticDetail(diagnostic.detail),
  };
}

export function sanitizeDiagnosticDetail(detail: unknown): unknown {
  return sanitizeDiagnosticValue(detail);
}

function sanitizeDiagnosticValue(
  value: unknown,
  depth = 0,
  seen = new WeakSet<object>(),
): unknown {
  if (
    value == null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (typeof value === 'bigint') return `${value.toString()}n`;
  if (typeof value === 'symbol') return value.toString();
  if (typeof value === 'function') {
    return `[Function ${value.name || 'anonymous'}]`;
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }
  if (typeof value !== 'object') return String(value);
  if (seen.has(value)) return '[Circular]';
  if (depth >= 4) return '[Object]';
  seen.add(value);
  if (Array.isArray(value)) {
    return value.map((entry) =>
      sanitizeDiagnosticValue(entry, depth + 1, seen),
    );
  }
  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    result[key] = sanitizeDiagnosticValue(entry, depth + 1, seen);
  }
  return result;
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
