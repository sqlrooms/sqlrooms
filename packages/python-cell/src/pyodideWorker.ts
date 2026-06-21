/// <reference lib="webworker" />

import {loadPyodide, type PyodideAPI} from 'pyodide';
import type {
  PythonExecutionOutput,
  PythonExecutionRequest,
  PythonExecutionResult,
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

let pyodidePromise: Promise<PyodideAPI> | undefined;
let executionQueue = Promise.resolve();

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
  return pyodidePromise;
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
    const packageNames = (request.requirements ?? [])
      .filter((requirement) => requirement.source !== 'host')
      .map((requirement) => requirement.name);
    if (packageNames.length) {
      await pyodide.loadPackage(packageNames);
    }

    pyodide.runPython('globals().pop("result", None)');
    await pyodide.runPythonAsync(request.code, {
      filename: `<sqlrooms-python-cell:${request.blockId}>`,
    });

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
