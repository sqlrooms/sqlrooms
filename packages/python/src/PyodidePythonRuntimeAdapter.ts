import type {
  PythonExecutionRequest,
  PythonExecutionResult,
  PythonSchemaSummary,
  PythonRuntimeAdapter,
  PythonRuntimeHost,
  PythonTabularInput,
} from './types';

type PyodideWorkerRequestMessage = {
  type: 'execute';
  request: PythonExecutionRequest;
  indexURL?: string;
};

type PyodideHostRequest =
  | {
      type: 'query';
      query: string;
      maxRows?: number;
    }
  | {
      type: 'table';
      tableName: string;
      maxRows?: number;
    }
  | {
      type: 'schema';
      tableName?: string;
    };

type PyodideHostResponse =
  | {
      ok: true;
      result: PythonTabularInput;
    }
  | {
      ok: true;
      result: PythonSchemaSummary;
    }
  | {
      ok: false;
      error: {
        name?: string;
        message: string;
        traceback?: string;
      };
    };

type PyodideWorkerResponseMessage =
  | {
      type: 'started';
      executionId: string;
    }
  | {
      type: 'result';
      executionId: string;
      result: PythonExecutionResult;
    }
  | {
      type: 'error';
      executionId: string;
      error: {
        name?: string;
        message: string;
        traceback?: string;
      };
    }
  | {
      type: 'hostRequest';
      executionId: string;
      requestId: string;
      request: PyodideHostRequest;
      signal: SharedArrayBuffer;
      response: SharedArrayBuffer;
    };

export type CreatePyodidePythonRuntimeAdapterOptions = {
  indexURL?: string;
};

const DEFAULT_PYODIDE_INDEX_URL =
  'https://cdn.jsdelivr.net/pyodide/v0.28.3/full/';

/** Creates a browser-worker-backed Python runtime adapter using Pyodide. */
export function createPyodidePythonRuntimeAdapter({
  indexURL = DEFAULT_PYODIDE_INDEX_URL,
}: CreatePyodidePythonRuntimeAdapterOptions = {}): PythonRuntimeAdapter {
  return new PyodidePythonRuntimeAdapter(indexURL);
}

class PyodidePythonRuntimeAdapter implements PythonRuntimeAdapter {
  id = 'pyodide' as const;
  private worker: Worker | undefined;
  private pending = new Map<
    string,
    {
      resolve: (result: PythonExecutionResult) => void;
      reject: (error: Error) => void;
      host: PythonRuntimeHost;
      timeoutId?: ReturnType<typeof setTimeout>;
      timeoutMs?: number;
    }
  >();
  private state: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
  private message: string | undefined;

  constructor(private readonly indexURL: string) {}

  async status() {
    return {
      state: this.state,
      message: this.message,
    };
  }

  async execute(
    request: PythonExecutionRequest,
    host: PythonRuntimeHost,
  ): Promise<PythonExecutionResult> {
    if (typeof Worker === 'undefined') {
      throw new Error('Pyodide Python execution requires a browser Worker.');
    }
    if (typeof SharedArrayBuffer === 'undefined') {
      throw new Error(
        'Pyodide Python execution requires SharedArrayBuffer for SQLRooms host bridge calls.',
      );
    }

    const worker = this.ensureWorker();
    this.state = this.state === 'idle' ? 'loading' : this.state;

    return new Promise((resolve, reject) => {
      this.pending.set(request.executionId, {
        resolve,
        reject,
        host,
        timeoutMs: request.limits?.timeoutMs,
      });
      worker.postMessage({
        type: 'execute',
        request,
        indexURL: this.indexURL,
      } satisfies PyodideWorkerRequestMessage);
    });
  }

  async dispose() {
    this.terminateWorkerAndRejectPending(
      new Error('Python runtime adapter disposed.'),
    );
    this.state = 'idle';
    this.message = undefined;
  }

  private ensureWorker() {
    if (this.worker) return this.worker;

    const worker = new Worker(new URL('./pyodideWorker.js', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (event: MessageEvent<PyodideWorkerResponseMessage>) => {
      const message = event.data;
      const pending = this.pending.get(message.executionId);
      if (!pending) return;

      if (message.type === 'started') {
        this.startExecutionTimeout(message.executionId, pending);
        return;
      }

      if (message.type === 'result') {
        this.pending.delete(message.executionId);
        if (pending.timeoutId) clearTimeout(pending.timeoutId);
        this.state = 'ready';
        this.message = undefined;
        pending.resolve(message.result);
        return;
      }

      if (message.type === 'error') {
        this.pending.delete(message.executionId);
        if (pending.timeoutId) clearTimeout(pending.timeoutId);
        this.state = 'error';
        this.message = message.error.message;
        pending.reject(
          Object.assign(new Error(message.error.message), {
            name: message.error.name ?? 'PyodideWorkerError',
          }),
        );
        return;
      }

      void this.handleHostRequest(message, pending.host);
    };
    worker.onerror = (event) => {
      this.state = 'error';
      this.message = event.message;
      this.terminateWorkerAndRejectPending(new Error(event.message));
    };
    this.worker = worker;
    return worker;
  }

  private startExecutionTimeout(
    executionId: string,
    pending: {
      timeoutId?: ReturnType<typeof setTimeout>;
      timeoutMs?: number;
    },
  ) {
    if (!pending.timeoutMs || pending.timeoutId) return;
    pending.timeoutId = setTimeout(() => {
      const currentPending = this.pending.get(executionId);
      if (!currentPending) return;
      this.state = 'error';
      this.message = `Python execution exceeded ${pending.timeoutMs}ms.`;
      this.terminateWorkerAndRejectPending(
        Object.assign(new Error(this.message), {
          name: 'PythonExecutionTimeout',
        }),
      );
    }, pending.timeoutMs);
  }

  private terminateWorkerAndRejectPending(error: Error) {
    this.worker?.terminate();
    this.worker = undefined;
    for (const pending of this.pending.values()) {
      if (pending.timeoutId) clearTimeout(pending.timeoutId);
      pending.reject(error);
    }
    this.pending.clear();
  }

  private async handleHostRequest(
    message: Extract<PyodideWorkerResponseMessage, {type: 'hostRequest'}>,
    host: PythonRuntimeHost,
  ) {
    const signal = new Int32Array(message.signal);
    try {
      const response = await resolveHostRequest(message.request, host);
      writeHostResponse(message.response, response);
    } catch (error) {
      writeHostResponse(message.response, {
        ok: false,
        error: errorSummary(error),
      });
    } finally {
      Atomics.store(signal, 0, 1);
      Atomics.notify(signal, 0);
    }
  }
}

async function resolveHostRequest(
  request: PyodideHostRequest,
  host: PythonRuntimeHost,
): Promise<PyodideHostResponse> {
  if (request.type === 'query') {
    if (!host.runReadonlySql) {
      throw new Error('SQLRooms Python query bridge is not configured.');
    }
    return {
      ok: true,
      result: await host.runReadonlySql({
        query: request.query,
        maxRows: request.maxRows,
      }),
    };
  }

  if (request.type === 'table') {
    return {
      ok: true,
      result: await host.readTable({
        kind: 'tableRef',
        name: request.tableName,
        tableName: request.tableName,
        maxRows: request.maxRows,
      }),
    };
  }

  if (request.type === 'schema') {
    if (!host.readSchema) {
      throw new Error('SQLRooms Python schema bridge is not configured.');
    }
    return {
      ok: true,
      result: await host.readSchema({tableName: request.tableName}),
    };
  }

  throw new Error('Unsupported SQLRooms Python bridge request.');
}

function writeHostResponse(
  buffer: SharedArrayBuffer,
  response: PyodideHostResponse,
) {
  const header = new Int32Array(buffer, 0, 1);
  const body = new Uint8Array(buffer, 4);
  const bytes = new TextEncoder().encode(JSON.stringify(response));

  if (bytes.byteLength > body.byteLength) {
    const overflowResponse = new TextEncoder().encode(
      JSON.stringify({
        ok: false,
        error: {
          name: 'SQLRoomsBridgeResponseTooLarge',
          message: `SQLRooms Python bridge response exceeded ${body.byteLength} bytes.`,
        },
      } satisfies PyodideHostResponse),
    );
    header[0] = overflowResponse.byteLength;
    body.set(overflowResponse);
    return;
  }

  header[0] = bytes.byteLength;
  body.set(bytes);
}

function errorSummary(error: unknown) {
  return {
    name: error instanceof Error ? error.name : undefined,
    message:
      error instanceof Error
        ? error.message
        : 'SQLRooms bridge request failed.',
    traceback: error instanceof Error ? error.stack : undefined,
  };
}
