import {
  QueryRequest,
  QueryResult,
  RuntimeMessage,
  RuntimeResponseMessage,
  createRuntimeDiagnostic,
  createRuntimeRequest,
  type AppDiagnostic,
  type RuntimeErrorPayload,
  type RuntimeRequestMethod,
} from './protocol';

export type AppRuntimeClient = {
  query: (
    sql: string,
    options?: Omit<QueryRequest, 'sql'>,
  ) => Promise<QueryResult>;
  queryRows: (
    sql: string,
    options?: Omit<QueryRequest, 'sql'>,
  ) => Promise<Record<string, unknown>[]>;
  reportDiagnostic: (diagnostic: AppDiagnostic) => void;
  dispose: () => void;
};

export type CreateAppClientOptions = {
  targetWindow?: Window;
  currentWindow?: Window;
  targetOrigin?: string;
  requestTimeoutMs?: number;
  idPrefix?: string;
};

type PendingRequest = {
  resolve: (payload: unknown) => void;
  reject: (error: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
};

const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;

export class AppRuntimeError extends Error {
  readonly code: RuntimeErrorPayload['code'];
  readonly detail?: unknown;
  readonly sql?: string;

  constructor(error: RuntimeErrorPayload) {
    super(error.message);
    this.name = 'AppRuntimeError';
    this.code = error.code;
    this.detail = error.detail;
    this.sql = error.sql;
  }
}

export function createAppClient({
  targetWindow,
  currentWindow = window,
  targetOrigin = '*',
  requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  idPrefix = 'app-runtime',
}: CreateAppClientOptions = {}): AppRuntimeClient {
  const resolvedTargetWindow = targetWindow ?? currentWindow.parent;
  const pending = new Map<string, PendingRequest>();
  let nextId = 0;

  const handleMessage = (event: MessageEvent) => {
    if (event.source !== resolvedTargetWindow) return;
    const parsed = RuntimeMessage.safeParse(event.data);
    if (!parsed.success || parsed.data.direction !== 'response') return;
    const message = parsed.data;
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    clearTimeout(request.timeoutId);
    if (message.ok) {
      request.resolve(message.payload);
    } else {
      request.reject(
        new AppRuntimeError(
          message.error ?? {
            code: 'invalid_request',
            message: 'Runtime request failed without an error payload.',
          },
        ),
      );
    }
  };

  currentWindow.addEventListener('message', handleMessage);

  const request = async (
    method: RuntimeRequestMethod,
    payload?: unknown,
  ): Promise<unknown> => {
    const id = `${idPrefix}:${Date.now().toString(36)}:${nextId++}`;
    const message = createRuntimeRequest(id, method, payload);
    const responsePromise = new Promise<unknown>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        pending.delete(id);
        reject(
          new AppRuntimeError({
            code: 'timeout',
            message: `Runtime request "${method}" timed out.`,
          }),
        );
      }, requestTimeoutMs);
      pending.set(id, {resolve, reject, timeoutId});
    });
    resolvedTargetWindow.postMessage(message, targetOrigin);
    return responsePromise;
  };

  return {
    async query(sql, options = {}) {
      const payload = QueryRequest.parse({sql, ...options});
      const response = await request('query', payload);
      return QueryResult.parse(response);
    },
    async queryRows(sql, options = {}) {
      const result = await this.query(sql, options);
      return result.rows;
    },
    reportDiagnostic(diagnostic) {
      resolvedTargetWindow.postMessage(
        createRuntimeDiagnostic({
          ...diagnostic,
          timestamp: diagnostic.timestamp ?? Date.now(),
        }),
        targetOrigin,
      );
    },
    dispose() {
      currentWindow.removeEventListener('message', handleMessage);
      for (const request of pending.values()) {
        clearTimeout(request.timeoutId);
        request.reject(
          new AppRuntimeError({
            code: 'aborted',
            message: 'Runtime client disposed before the request completed.',
          }),
        );
      }
      pending.clear();
    },
  };
}

export function installGlobalClient(
  options?: CreateAppClientOptions & {globalName?: string},
): AppRuntimeClient {
  const {
    globalName = 'sqlrooms',
    currentWindow = window,
    ...clientOptions
  } = options ?? {};
  const client = createAppClient({...clientOptions, currentWindow});
  Object.defineProperty(currentWindow, globalName, {
    configurable: true,
    value: client,
  });
  return client;
}

declare global {
  interface Window {
    sqlrooms?: AppRuntimeClient;
  }
}
