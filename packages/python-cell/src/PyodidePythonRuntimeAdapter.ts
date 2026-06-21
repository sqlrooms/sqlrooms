import type {
  PythonExecutionRequest,
  PythonExecutionResult,
  PythonRuntimeAdapter,
} from './types';

type PyodideWorkerRequestMessage = {
  type: 'execute';
  request: PythonExecutionRequest;
  indexURL?: string;
};

type PyodideWorkerResponseMessage =
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
  ): Promise<PythonExecutionResult> {
    if (typeof Worker === 'undefined') {
      throw new Error('Pyodide Python execution requires a browser Worker.');
    }

    const worker = this.ensureWorker();
    this.state = this.state === 'idle' ? 'loading' : this.state;

    return new Promise((resolve, reject) => {
      this.pending.set(request.executionId, {resolve, reject});
      worker.postMessage({
        type: 'execute',
        request,
        indexURL: this.indexURL,
      } satisfies PyodideWorkerRequestMessage);
    });
  }

  async dispose() {
    this.worker?.terminate();
    this.worker = undefined;
    this.pending.clear();
    this.state = 'idle';
    this.message = undefined;
  }

  private ensureWorker() {
    if (this.worker) return this.worker;

    const worker = new Worker(new URL('./pyodideWorker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (event: MessageEvent<PyodideWorkerResponseMessage>) => {
      const message = event.data;
      const pending = this.pending.get(message.executionId);
      if (!pending) return;
      this.pending.delete(message.executionId);

      if (message.type === 'result') {
        this.state = 'ready';
        this.message = undefined;
        pending.resolve(message.result);
      } else {
        this.state = 'error';
        this.message = message.error.message;
        pending.reject(
          Object.assign(new Error(message.error.message), {
            name: message.error.name ?? 'PyodideWorkerError',
          }),
        );
      }
    };
    worker.onerror = (event) => {
      this.state = 'error';
      this.message = event.message;
      for (const pending of this.pending.values()) {
        pending.reject(new Error(event.message));
      }
      this.pending.clear();
    };
    this.worker = worker;
    return worker;
  }
}
