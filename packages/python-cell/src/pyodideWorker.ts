/// <reference lib="webworker" />

import {loadPyodide, type PyodideAPI} from 'pyodide';
import type {
  PythonExecutionOutput,
  PythonExecutionRequest,
  PythonExecutionResult,
  PythonTabularInput,
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
    }
  | {
      type: 'hostRequest';
      executionId: string;
      requestId: string;
      request: PyodideHostRequest;
      signal: SharedArrayBuffer;
      response: SharedArrayBuffer;
    };

type PyodideHostRequest = {
  type: 'query';
  query: string;
  maxRows?: number;
};

type PyodideHostResponse =
  | {
      ok: true;
      result: PythonTabularInput;
    }
  | {
      ok: false;
      error: {
        name?: string;
        message: string;
        traceback?: string;
      };
    };

const HOST_RESPONSE_BUFFER_BYTES = 16 * 1024 * 1024;
const SQLROOMS_MODULE_SOURCE = `
from _sqlrooms_bridge import query as _query


def query(sql, max_rows=None):
    """Run a SQLRooms host query and return {'columns', 'rows', 'rowCount'}."""
    return _query(str(sql), max_rows).to_py()


def query_df(sql, max_rows=None):
    """Run a SQLRooms host query and return a pandas DataFrame."""
    import pandas as pd

    result = query(sql, max_rows=max_rows)
    return pd.DataFrame(result["rows"], columns=result["columns"])
`;

let pyodidePromise: Promise<PyodideAPI> | undefined;
let executionQueue = Promise.resolve();
let bridgeInstalled = false;
let activeExecutionId: string | undefined;

self.onmessage = (event: MessageEvent<PyodideWorkerRequestMessage>) => {
  const message = event.data;
  if (message.type !== 'execute') return;

  const execution = executionQueue.then(() =>
    executePython(message.request, message.indexURL),
  );
  executionQueue = execution.then(
    () => undefined,
    () => undefined,
  );

  void execution
    .then((result) => {
      postMessage({
        type: 'result',
        executionId: message.request.executionId,
        result,
      } satisfies PyodideWorkerResponseMessage);
    })
    .catch((error) => {
      postMessage({
        type: 'error',
        executionId: message.request.executionId,
        error: errorSummary(error),
      } satisfies PyodideWorkerResponseMessage);
    });
};

async function getPyodide(indexURL: string | undefined) {
  pyodidePromise ??= loadPyodide({
    ...(indexURL ? {indexURL} : {}),
  });
  const pyodide = await pyodidePromise;
  if (!bridgeInstalled) {
    installSqlroomsBridge(pyodide);
    bridgeInstalled = true;
  }
  return pyodide;
}

async function executePython(
  request: PythonExecutionRequest,
  indexURL: string | undefined,
): Promise<PythonExecutionResult> {
  const startedAt = Date.now();
  const pyodide = await getPyodide(indexURL);
  const stdout: string[] = [];
  const stderr: string[] = [];

  pyodide.setStdout({batched: (output) => stdout.push(output)});
  pyodide.setStderr({batched: (output) => stderr.push(output)});

  try {
    const packageNames = new Set(
      (request.requirements ?? [])
        .filter((requirement) => requirement.source !== 'host')
        .map((requirement) => requirement.name),
    );
    if (usesSqlroomsBridge(request.code)) {
      packageNames.add('pandas');
    }
    if (packageNames.size) {
      await pyodide.loadPackage([...packageNames]);
    }

    pyodide.runPython('globals().pop("result", None)');
    activeExecutionId = request.executionId;
    try {
      await pyodide.runPythonAsync(request.code, {
        filename: `<sqlrooms-python-cell:${request.blockId}>`,
      });
    } finally {
      activeExecutionId = undefined;
    }

    const outputs = readResultOutput(pyodide);
    return {
      executionId: request.executionId,
      status: 'success',
      stdout: stdout.join('\n'),
      stderr: stderr.join('\n'),
      outputs,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      executionId: request.executionId,
      status: 'error',
      stdout: stdout.join('\n'),
      stderr: stderr.join('\n'),
      error: errorSummary(error),
      outputs: [],
      durationMs: Date.now() - startedAt,
    };
  }
}

function installSqlroomsBridge(pyodide: PyodideAPI) {
  pyodide.registerJsModule('_sqlrooms_bridge', {
    query: requestHostQuery,
  });
  pyodide.FS.writeFile('/tmp/sqlrooms.py', SQLROOMS_MODULE_SOURCE);
  pyodide.runPython(`
import sys as __sqlrooms_sys
if "/tmp" not in __sqlrooms_sys.path:
    __sqlrooms_sys.path.insert(0, "/tmp")
`);
}

function requestHostQuery(query: unknown, maxRows?: unknown) {
  if (!activeExecutionId) {
    throw new Error(
      'SQLRooms host bridge is only available while a cell runs.',
    );
  }

  const signal = new SharedArrayBuffer(4);
  const response = new SharedArrayBuffer(4 + HOST_RESPONSE_BUFFER_BYTES);
  const normalizedMaxRows = normalizeMaxRows(maxRows);
  const request: PyodideHostRequest = {
    type: 'query',
    query: String(query),
    ...(normalizedMaxRows === undefined ? {} : {maxRows: normalizedMaxRows}),
  };

  postMessage({
    type: 'hostRequest',
    executionId: activeExecutionId,
    requestId: createRequestId(),
    request,
    signal,
    response,
  } satisfies PyodideWorkerResponseMessage);

  Atomics.wait(new Int32Array(signal), 0, 0);
  return readHostResponse(response);
}

function readHostResponse(buffer: SharedArrayBuffer) {
  const length = new Int32Array(buffer, 0, 1)[0] ?? 0;
  const bytes = new Uint8Array(length);
  bytes.set(new Uint8Array(buffer, 4, length));
  const response = JSON.parse(
    new TextDecoder().decode(bytes),
  ) as PyodideHostResponse;

  if (!response.ok) {
    throw Object.assign(new Error(response.error.message), {
      name: response.error.name ?? 'SQLRoomsBridgeError',
    });
  }

  return response.result;
}

function usesSqlroomsBridge(code: string) {
  return /\b(import\s+sqlrooms|from\s+sqlrooms\s+import)\b/.test(code);
}

function normalizeMaxRows(value: unknown) {
  if (value == null) return undefined;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return undefined;
  return Math.max(0, Math.floor(numericValue));
}

function createRequestId() {
  return crypto.randomUUID();
}

function readResultOutput(pyodide: PyodideAPI): PythonExecutionOutput[] {
  const hasResult = pyodide.runPython('"result" in globals()');
  if (!hasResult) return [];

  const resultJson = pyodide.runPython(`
import json as __sqlrooms_json
__sqlrooms_json.dumps(result, default=str)
`);
  return [
    {
      type: 'json',
      name: 'result',
      value: JSON.parse(String(resultJson)),
    },
  ];
}

function errorSummary(error: unknown) {
  return {
    name: error instanceof Error ? error.name : undefined,
    message:
      error instanceof Error ? error.message : 'Python execution failed.',
    traceback: error instanceof Error ? error.stack : undefined,
  };
}
