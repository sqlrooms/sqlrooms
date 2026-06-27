/// <reference lib="webworker" />

import {loadPyodide, type PyodideAPI} from 'pyodide';
import type {PyProxy} from 'pyodide/ffi';
import type {
  PythonInput,
  PythonOutputDeclaration,
  PythonExecutionOutput,
  PythonExecutionRequest,
  PythonExecutionResult,
  PythonRequirementSpec,
  PythonSchemaSummary,
  PythonTabularInput,
} from './types';

type PyodideWorkerRequestMessage = {
  type: 'execute';
  request: PythonExecutionRequest;
  indexURL?: string;
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

const HOST_RESPONSE_BUFFER_BYTES = 16 * 1024 * 1024;
const DEFAULT_MAX_STDIO_BYTES = 32_000;
const DEFAULT_MAX_RICH_OUTPUT_BYTES = 512_000;
const VEGA_LITE_MIME_TYPES = [
  'application/vnd.vegalite.v5+json',
  'application/vnd.vegalite.v4+json',
  'application/vnd.vegalite.v3+json',
  'application/vnd.vegalite.v2+json',
] as const;
const SQLROOMS_MODULE_SOURCE = `
from _sqlrooms_bridge import query as _query


def query_raw(sql, max_rows=None):
    """Run a SQLRooms host query and return {'columns', 'rows', 'rowCount'}."""
    return _query(str(sql), max_rows).to_py()


def query_records(sql, max_rows=None):
    """Run a SQLRooms host query and return row records."""
    return query_raw(sql, max_rows=max_rows)["rows"]


def query_df(sql, max_rows=None):
    """Run a SQLRooms host query and return a pandas DataFrame."""
    import pandas as pd

    result = query_raw(sql, max_rows=max_rows)
    frame = pd.DataFrame(result["rows"], columns=result["columns"])
    for column, column_type in result.get("columnTypes", {}).items():
        if column not in frame.columns:
            continue
        if column_type == "timestamp":
            frame[column] = pd.to_datetime(frame[column], errors="coerce")
        elif column_type == "date":
            frame[column] = pd.to_datetime(frame[column], errors="coerce").dt.date
    return frame


def query(sql, max_rows=None):
    """Run a SQLRooms host query and return a pandas DataFrame."""
    return query_df(sql, max_rows=max_rows)
`;

let pyodidePromise: Promise<PyodideAPI> | undefined;
let executionQueue = Promise.resolve();
let bridgeInstalled = false;
let activeExecutionId: string | undefined;
let activeMaxRowsPreview: number | undefined;

self.onmessage = (event: MessageEvent<PyodideWorkerRequestMessage>) => {
  const message = event.data;
  if (message.type !== 'execute') return;

  const execution = executionQueue.then(() => {
    postMessage({
      type: 'started',
      executionId: message.request.executionId,
    } satisfies PyodideWorkerResponseMessage);
    return executePython(message.request, message.indexURL);
  });
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
  const stdout = createBoundedTextBuffer(
    request.limits?.maxStdoutBytes ?? DEFAULT_MAX_STDIO_BYTES,
  );
  const stderr = createBoundedTextBuffer(
    request.limits?.maxStdoutBytes ?? DEFAULT_MAX_STDIO_BYTES,
  );

  pyodide.setStdout({batched: (output) => appendBoundedText(stdout, output)});
  pyodide.setStderr({batched: (output) => appendBoundedText(stderr, output)});

  try {
    const pyodidePackageNames = new Set(
      (request.requirements ?? [])
        .filter((requirement) => requirement.source !== 'host')
        .filter((requirement) => requirement.source !== 'micropip')
        .map((requirement) => requirement.name),
    );
    const micropipRequirements = (request.requirements ?? []).filter(
      (requirement) => requirement.source === 'micropip',
    );
    if (usesSqlroomsBridge(request.code)) {
      pyodidePackageNames.add('pandas');
    }
    if (pyodidePackageNames.size) {
      await pyodide.loadPackage([...pyodidePackageNames]);
    }
    if (micropipRequirements.length) {
      await installMicropipRequirements(pyodide, micropipRequirements);
    }
    if (usesAltair(request.code)) {
      await ensureAltair(pyodide);
    }

    const globals = createExecutionGlobals(pyodide);
    activeExecutionId = request.executionId;
    activeMaxRowsPreview = normalizeMaxRows(request.limits?.maxRowsPreview);
    try {
      bindInputs(pyodide, globals, request.inputs);
      // The adapter starts timeoutMs when it receives this worker's "started"
      // message and terminates the worker if execution exceeds that budget.
      const lastExpressionResult = await pyodide.runPythonAsync(request.code, {
        globals,
        filename: `<sqlrooms-python-block:${request.blockId}>`,
      });
      try {
        const hasResult = pyodide.runPython('"result" in globals()', {globals});
        if (!hasResult && lastExpressionResult !== undefined) {
          globals.set('result', lastExpressionResult);
        }
      } finally {
        if (isPyProxy(lastExpressionResult)) {
          lastExpressionResult.destroy();
        }
      }
      const outputs = readResultOutput(
        pyodide,
        globals,
        request.outputDeclarations,
      );
      return {
        executionId: request.executionId,
        status: 'success',
        stdout: readBoundedText(stdout),
        stderr: readBoundedText(stderr),
        outputs,
        durationMs: Date.now() - startedAt,
      };
    } finally {
      activeExecutionId = undefined;
      activeMaxRowsPreview = undefined;
      globals.destroy();
    }
  } catch (error) {
    return {
      executionId: request.executionId,
      status: 'error',
      stdout: readBoundedText(stdout),
      stderr: readBoundedText(stderr),
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
  const executionId = getActiveHostBridgeExecutionId();

  const signal = new SharedArrayBuffer(4);
  const response = new SharedArrayBuffer(4 + HOST_RESPONSE_BUFFER_BYTES);
  const normalizedMaxRows = normalizeMaxRows(maxRows) ?? activeMaxRowsPreview;
  const request: PyodideHostRequest = {
    type: 'query',
    query: String(query),
    ...(normalizedMaxRows === undefined ? {} : {maxRows: normalizedMaxRows}),
  };

  postMessage({
    type: 'hostRequest',
    executionId,
    requestId: createRequestId(),
    request,
    signal,
    response,
  } satisfies PyodideWorkerResponseMessage);

  Atomics.wait(new Int32Array(signal), 0, 0);
  return readHostResponse(response);
}

function requestHostTable(tableName: string, maxRows?: unknown) {
  const executionId = getActiveHostBridgeExecutionId();

  const signal = new SharedArrayBuffer(4);
  const response = new SharedArrayBuffer(4 + HOST_RESPONSE_BUFFER_BYTES);
  const normalizedMaxRows = normalizeMaxRows(maxRows) ?? activeMaxRowsPreview;
  const request: PyodideHostRequest = {
    type: 'table',
    tableName,
    ...(normalizedMaxRows === undefined ? {} : {maxRows: normalizedMaxRows}),
  };

  postMessage({
    type: 'hostRequest',
    executionId,
    requestId: createRequestId(),
    request,
    signal,
    response,
  } satisfies PyodideWorkerResponseMessage);

  Atomics.wait(new Int32Array(signal), 0, 0);
  return readHostResponse(response);
}

function requestHostSchema(tableName?: string) {
  const executionId = getActiveHostBridgeExecutionId();

  const signal = new SharedArrayBuffer(4);
  const response = new SharedArrayBuffer(4 + HOST_RESPONSE_BUFFER_BYTES);
  const request: PyodideHostRequest = {
    type: 'schema',
    ...(tableName ? {tableName} : {}),
  };

  postMessage({
    type: 'hostRequest',
    executionId,
    requestId: createRequestId(),
    request,
    signal,
    response,
  } satisfies PyodideWorkerResponseMessage);

  Atomics.wait(new Int32Array(signal), 0, 0);
  return readHostResponse(response);
}

function getActiveHostBridgeExecutionId(): string {
  if (!activeExecutionId) {
    throw new Error(
      'SQLRooms host bridge is only available while a Python block runs.',
    );
  }
  if (typeof SharedArrayBuffer === 'undefined') {
    throw new Error(
      'SQLRooms host bridge requires SharedArrayBuffer. Enable cross-origin isolation before running Python code that queries SQLRooms data.',
    );
  }
  return activeExecutionId;
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

function usesAltair(code: string) {
  return /\b(import\s+altair|from\s+altair(?:\.[\w_]+)*\s+import)\b/.test(code);
}

async function installMicropipRequirements(
  pyodide: PyodideAPI,
  requirements: PythonRequirementSpec[],
) {
  await pyodide.loadPackage('micropip');
  pyodide.globals.set(
    '__sqlrooms_micropip_requirements',
    requirements.map(formatMicropipRequirement),
  );
  await pyodide.runPythonAsync(`
import micropip as __sqlrooms_micropip
await __sqlrooms_micropip.install(__sqlrooms_micropip_requirements)
`);
  pyodide.runPython('globals().pop("__sqlrooms_micropip_requirements", None)');
}

function formatMicropipRequirement(requirement: PythonRequirementSpec) {
  if (!requirement.version) return requirement.name;
  if (/^[<>=!~]/.test(requirement.version)) {
    return `${requirement.name}${requirement.version}`;
  }
  return `${requirement.name}==${requirement.version}`;
}

async function ensureAltair(pyodide: PyodideAPI) {
  const hasAltair = pyodide.runPython(`
import importlib.util as __sqlrooms_importlib_util
__sqlrooms_importlib_util.find_spec("altair") is not None
`);
  if (hasAltair) return;

  await pyodide.loadPackage('micropip');
  await pyodide.runPythonAsync(`
import micropip as __sqlrooms_micropip
await __sqlrooms_micropip.install("altair")
`);
}

function createExecutionGlobals(pyodide: PyodideAPI): PyProxy {
  return pyodide.runPython('dict()') as PyProxy;
}

function bindInputs(
  pyodide: PyodideAPI,
  globals: PyProxy,
  inputs: PythonInput[],
) {
  for (const input of inputs) {
    if (input.kind === 'literal') {
      bindPythonGlobal(pyodide, globals, input.name, input.value);
      continue;
    }

    if (input.kind === 'sql') {
      bindPythonGlobal(
        pyodide,
        globals,
        input.name,
        requestHostQuery(input.query, input.maxRows),
      );
      continue;
    }

    if (input.kind === 'tableRef') {
      bindPythonGlobal(
        pyodide,
        globals,
        input.name,
        requestHostTable(input.tableName, input.maxRows),
      );
      continue;
    }

    bindPythonGlobal(
      pyodide,
      globals,
      input.name,
      requestHostSchema(input.tableName),
    );
  }
}

function bindPythonGlobal(
  pyodide: PyodideAPI,
  globals: PyProxy,
  name: string,
  value: unknown,
) {
  const pythonValue = pyodide.toPy(value);
  globals.set(name, pythonValue);
  if (isPyProxy(pythonValue)) {
    pythonValue.destroy();
  }
}

function isPyProxy(value: unknown): value is PyProxy {
  return (
    typeof value === 'object' &&
    value !== null &&
    'destroy' in value &&
    typeof (value as {destroy?: unknown}).destroy === 'function'
  );
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

function readResultOutput(
  pyodide: PyodideAPI,
  globals: PyProxy,
  outputDeclarations: PythonOutputDeclaration[],
): PythonExecutionOutput[] {
  const hasResult = pyodide.runPython('"result" in globals()', {globals});
  const declaredOutputs = outputDeclarations.map((output) => ({
    type: output.type,
    name: output.name,
  }));
  if (!hasResult && declaredOutputs.length === 0) return [];

  bindPythonGlobal(
    pyodide,
    globals,
    '__sqlrooms_output_declarations',
    declaredOutputs,
  );
  globals.set(
    '__sqlrooms_max_rich_output_bytes',
    DEFAULT_MAX_RICH_OUTPUT_BYTES,
  );
  globals.set('__sqlrooms_max_text_output_bytes', DEFAULT_MAX_STDIO_BYTES);

  const outputsJson = pyodide.runPython(
    `
import builtins as __sqlrooms_builtins
import json as __sqlrooms_json
import math as __sqlrooms_math

if __sqlrooms_builtins.hasattr(__sqlrooms_output_declarations, "to_py"):
    __sqlrooms_output_declarations = __sqlrooms_output_declarations.to_py()

def __sqlrooms_is_mapping(value):
    return __sqlrooms_builtins.hasattr(value, "keys") and __sqlrooms_builtins.hasattr(value, "__getitem__")

def __sqlrooms_is_vegalite_spec(value):
    if not __sqlrooms_builtins.isinstance(value, __sqlrooms_builtins.dict):
        return False
    schema = __sqlrooms_builtins.str(value.get("$schema", "")).lower()
    return (
        "vega-lite" in schema
        or "mark" in value
        or "encoding" in value
        or "layer" in value
        or "hconcat" in value
        or "vconcat" in value
        or "facet" in value
    )

def __sqlrooms_safe_call(callable_value):
    try:
        return callable_value()
    except __sqlrooms_builtins.TypeError:
        return None
    except __sqlrooms_builtins.Exception:
        return None

def __sqlrooms_charge_json_bytes(value, budget):
    if budget["remaining"] <= 0:
        budget["truncated"] = True
        return
    budget["remaining"] -= __sqlrooms_builtins.len(
        __sqlrooms_builtins.str(value).encode("utf-8", "replace")
    )
    if budget["remaining"] < 0:
        budget["truncated"] = True

def __sqlrooms_bounded_string(value, budget):
    text = __sqlrooms_builtins.str(value)
    encoded = text.encode("utf-8", "replace")
    if __sqlrooms_builtins.len(encoded) <= budget["remaining"]:
        budget["remaining"] -= __sqlrooms_builtins.len(encoded)
        return text
    budget["truncated"] = True
    allowed = __sqlrooms_builtins.max(0, budget["remaining"])
    budget["remaining"] = 0
    return encoded[:allowed].decode("utf-8", "ignore") + "\\n... truncated ..."

def __sqlrooms_json_safe(value, budget=None):
    if budget is not None and budget["remaining"] <= 0:
        budget["truncated"] = True
        return None
    if __sqlrooms_builtins.isinstance(value, __sqlrooms_builtins.float):
        __sqlrooms_charge_json_bytes(value, budget) if budget is not None else None
        return value if __sqlrooms_math.isfinite(value) else None
    if value is None or __sqlrooms_builtins.isinstance(
        value,
        (__sqlrooms_builtins.bool, __sqlrooms_builtins.int),
    ):
        __sqlrooms_charge_json_bytes(value, budget) if budget is not None else None
        return value
    if __sqlrooms_builtins.isinstance(value, __sqlrooms_builtins.str):
        return __sqlrooms_bounded_string(value, budget) if budget is not None else value
    if __sqlrooms_builtins.isinstance(value, __sqlrooms_builtins.dict):
        result = {}
        for key, item in value.items():
            if budget is not None and budget["remaining"] <= 0:
                budget["truncated"] = True
                break
            key_text = __sqlrooms_builtins.str(key)
            if budget is not None:
                key_text = __sqlrooms_bounded_string(key_text, budget)
            result[key_text] = __sqlrooms_json_safe(item, budget)
        return result
    if __sqlrooms_builtins.isinstance(
        value,
        (__sqlrooms_builtins.list, __sqlrooms_builtins.tuple),
    ):
        result = []
        for item in value:
            if budget is not None and budget["remaining"] <= 0:
                budget["truncated"] = True
                break
            result.append(__sqlrooms_json_safe(item, budget))
        return result
    return __sqlrooms_bounded_string(value, budget) if budget is not None else value

def __sqlrooms_json_exceeds_limit(value):
    try:
        encoded = __sqlrooms_json.dumps(
            value,
            default=__sqlrooms_builtins.str,
            allow_nan=False,
        ).encode("utf-8", "replace")
    except __sqlrooms_builtins.Exception:
        return False
    return __sqlrooms_builtins.len(encoded) > __sqlrooms_builtins.int(
        __sqlrooms_max_rich_output_bytes
    )

def __sqlrooms_text_output_for(output_type, name, field_name, value, max_bytes):
    budget = {"remaining": __sqlrooms_builtins.int(max_bytes), "truncated": False}
    return {
        "type": output_type,
        "name": name,
        field_name: __sqlrooms_bounded_string(value, budget),
    }

def __sqlrooms_plain_text_output_for(name, value):
    return __sqlrooms_text_output_for(
        "text",
        name,
        "text",
        value,
        __sqlrooms_max_text_output_bytes,
    )

def __sqlrooms_markdown_output_for(name, value):
    return __sqlrooms_text_output_for(
        "markdown",
        name,
        "markdown",
        value,
        __sqlrooms_max_text_output_bytes,
    )

def __sqlrooms_html_output_for(name, value):
    return __sqlrooms_text_output_for(
        "html",
        name,
        "html",
        value,
        __sqlrooms_max_rich_output_bytes,
    )

def __sqlrooms_json_output_for(name, value):
    budget = {
        "remaining": __sqlrooms_builtins.int(__sqlrooms_max_rich_output_bytes),
        "truncated": False,
    }
    safe_value = __sqlrooms_json_safe(value, budget)
    if budget["truncated"] or __sqlrooms_json_exceeds_limit(safe_value):
        return {
            "type": "text",
            "name": name,
            "text": "JSON output exceeded the persisted output size limit.",
        }
    return {"type": "json", "name": name, "value": safe_value}

def __sqlrooms_vegalite_output_for(name, spec):
    budget = {
        "remaining": __sqlrooms_builtins.int(__sqlrooms_max_rich_output_bytes),
        "truncated": False,
    }
    safe_spec = __sqlrooms_json_safe(spec, budget)
    if budget["truncated"] or __sqlrooms_json_exceeds_limit(safe_spec):
        return {
            "type": "text",
            "name": name,
            "text": "Vega-Lite output exceeded the persisted output size limit.",
        }
    return {"type": "vega-lite", "name": name, "spec": safe_spec}

def __sqlrooms_mimebundle_for(value):
    repr_mimebundle = __sqlrooms_builtins.getattr(
        value,
        "_repr_mimebundle_",
        None,
    )
    if repr_mimebundle is None:
        return None
    bundle = __sqlrooms_safe_call(repr_mimebundle)
    if __sqlrooms_builtins.isinstance(bundle, __sqlrooms_builtins.tuple) and bundle:
        bundle = bundle[0]
    return bundle if __sqlrooms_builtins.isinstance(bundle, __sqlrooms_builtins.dict) else None

def __sqlrooms_output_for(name, value, declared_type=None):
    if declared_type == "text":
        return __sqlrooms_plain_text_output_for(name, value)
    if declared_type == "markdown":
        return __sqlrooms_markdown_output_for(name, value)
    if declared_type == "html":
        if __sqlrooms_builtins.isinstance(value, __sqlrooms_builtins.str):
            return __sqlrooms_html_output_for(name, value)
        repr_html = __sqlrooms_builtins.getattr(value, "_repr_html_", None)
        if repr_html is not None:
            html = __sqlrooms_safe_call(repr_html)
            if html:
                return __sqlrooms_html_output_for(name, html)
        return __sqlrooms_html_output_for(name, value)
    if declared_type == "json":
        return __sqlrooms_json_output_for(name, value)
    if declared_type in ("table", "image"):
        return {
            "type": "text",
            "name": name,
            "text": f'Declared {declared_type} output "{name}" is not supported by the Pyodide adapter yet.',
        }

    bundle = __sqlrooms_mimebundle_for(value)
    if bundle:
        for mime_type in ${JSON.stringify([...VEGA_LITE_MIME_TYPES])}:
            if mime_type in bundle:
                spec = bundle[mime_type]
                if __sqlrooms_is_mapping(spec):
                    return __sqlrooms_vegalite_output_for(
                        name,
                        __sqlrooms_builtins.dict(spec),
                    )

    to_dict = __sqlrooms_builtins.getattr(value, "to_dict", None)
    if to_dict is not None:
        spec = __sqlrooms_safe_call(to_dict)
        if __sqlrooms_is_mapping(spec):
            spec = __sqlrooms_builtins.dict(spec)
            if __sqlrooms_is_vegalite_spec(spec):
                return __sqlrooms_vegalite_output_for(name, spec)

    if declared_type == "vega-lite" and __sqlrooms_is_mapping(value):
        return __sqlrooms_vegalite_output_for(
            name,
            __sqlrooms_builtins.dict(value),
        )

    if bundle:
        html = bundle.get("text/html")
        if html:
            return __sqlrooms_html_output_for(name, html)
        text = bundle.get("text/plain")
        if text:
            return __sqlrooms_plain_text_output_for(name, text)

    repr_html = __sqlrooms_builtins.getattr(value, "_repr_html_", None)
    if repr_html is not None:
        html = __sqlrooms_safe_call(repr_html)
        if html:
            return __sqlrooms_html_output_for(name, html)

    return __sqlrooms_json_output_for(name, value)

__sqlrooms_outputs = []
__sqlrooms_seen_output_names = __sqlrooms_builtins.set()
__sqlrooms_globals = __sqlrooms_builtins.globals()
for __sqlrooms_declaration in __sqlrooms_output_declarations:
    __sqlrooms_name = __sqlrooms_declaration.get("name")
    if __sqlrooms_name in __sqlrooms_globals:
        __sqlrooms_seen_output_names.add(__sqlrooms_name)
        __sqlrooms_outputs.append(
            __sqlrooms_output_for(
                __sqlrooms_name,
                __sqlrooms_globals[__sqlrooms_name],
                __sqlrooms_declaration.get("type"),
            )
        )

if "result" in __sqlrooms_globals and "result" not in __sqlrooms_seen_output_names:
    __sqlrooms_outputs.append(__sqlrooms_output_for("result", result))

__sqlrooms_json.dumps(
    __sqlrooms_json_safe(__sqlrooms_outputs),
    default=__sqlrooms_builtins.str,
    allow_nan=False,
)
`,
    {globals},
  );
  return JSON.parse(String(outputsJson)) as PythonExecutionOutput[];
}

type BoundedTextBuffer = {
  chunks: string[];
  maxBytes: number;
  byteLength: number;
  truncated: boolean;
};

function createBoundedTextBuffer(maxBytes: number): BoundedTextBuffer {
  return {
    chunks: [],
    maxBytes: Math.max(0, Math.floor(maxBytes)),
    byteLength: 0,
    truncated: false,
  };
}

function appendBoundedText(buffer: BoundedTextBuffer, output: string) {
  if (buffer.truncated) return;
  const separatorBytes = buffer.chunks.length ? 1 : 0;
  const outputBytes = new TextEncoder().encode(output).byteLength;
  const remainingBytes = buffer.maxBytes - buffer.byteLength - separatorBytes;

  if (remainingBytes <= 0) {
    buffer.truncated = true;
    return;
  }

  if (outputBytes <= remainingBytes) {
    buffer.chunks.push(output);
    buffer.byteLength += outputBytes + separatorBytes;
    return;
  }

  const suffix = '\n... truncated ...';
  const suffixBytes = new TextEncoder().encode(suffix).byteLength;
  const truncatedOutput = truncateToBytes(
    output,
    Math.max(0, remainingBytes - suffixBytes),
  );
  buffer.chunks.push(`${truncatedOutput}${suffix}`);
  buffer.byteLength = buffer.maxBytes;
  buffer.truncated = true;
}

function readBoundedText(buffer: BoundedTextBuffer) {
  return buffer.chunks.join('\n');
}

function truncateToBytes(value: string, maxBytes: number) {
  const encoder = new TextEncoder();
  let result = '';
  let byteLength = 0;
  for (const character of value) {
    const characterBytes = encoder.encode(character).byteLength;
    if (byteLength + characterBytes > maxBytes) break;
    result += character;
    byteLength += characterBytes;
  }
  return result;
}

function truncateErrorText(value: string | undefined) {
  if (value === undefined) return undefined;
  const encoded = new TextEncoder().encode(value);
  if (encoded.byteLength <= DEFAULT_MAX_STDIO_BYTES) return value;
  return `${truncateToBytes(value, DEFAULT_MAX_STDIO_BYTES)}\n... truncated ...`;
}

function errorSummary(error: unknown) {
  return {
    name: truncateErrorText(error instanceof Error ? error.name : undefined),
    message:
      truncateErrorText(
        error instanceof Error ? error.message : 'Python execution failed.',
      ) ?? 'Python execution failed.',
    traceback: truncateErrorText(
      error instanceof Error ? error.stack : undefined,
    ),
  };
}
