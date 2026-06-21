/// <reference lib="webworker" />

import {loadPyodide, type PyodideAPI} from 'pyodide';
import type {
  PythonCellInput,
  PythonCellOutputDeclaration,
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
    return pd.DataFrame(result["rows"], columns=result["columns"])


def query(sql, max_rows=None):
    """Run a SQLRooms host query and return a pandas DataFrame."""
    return query_df(sql, max_rows=max_rows)
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

    pyodide.runPython('globals().pop("result", None)');
    pyodide.runPython(
      'globals().pop("__sqlrooms_last_expression_result", None)',
    );
    activeExecutionId = request.executionId;
    try {
      bindInputs(pyodide, request.inputs);
      const lastExpressionResult = await pyodide.runPythonAsync(request.code, {
        filename: `<sqlrooms-python-cell:${request.blockId}>`,
      });
      const hasResult = pyodide.runPython('"result" in globals()');
      if (!hasResult && lastExpressionResult !== undefined) {
        pyodide.globals.set('result', lastExpressionResult);
      }
    } finally {
      activeExecutionId = undefined;
    }

    const outputs = readResultOutput(pyodide, request.outputDeclarations);
    return {
      executionId: request.executionId,
      status: 'success',
      stdout: readBoundedText(stdout),
      stderr: readBoundedText(stderr),
      outputs,
      durationMs: Date.now() - startedAt,
    };
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

function requestHostSchema(tableName?: string) {
  if (!activeExecutionId) {
    throw new Error(
      'SQLRooms host bridge is only available while a cell runs.',
    );
  }

  const signal = new SharedArrayBuffer(4);
  const response = new SharedArrayBuffer(4 + HOST_RESPONSE_BUFFER_BYTES);
  const request: PyodideHostRequest = {
    type: 'schema',
    ...(tableName ? {tableName} : {}),
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

function bindInputs(pyodide: PyodideAPI, inputs: PythonCellInput[]) {
  for (const input of inputs) {
    if (input.kind === 'literal') {
      pyodide.globals.set(input.name, input.value);
      continue;
    }

    if (input.kind === 'sql') {
      bindPythonGlobal(
        pyodide,
        input.name,
        requestHostQuery(input.query, input.maxRows),
      );
      continue;
    }

    if (input.kind === 'tableRef') {
      bindPythonGlobal(
        pyodide,
        input.name,
        requestHostQuery(
          `SELECT * FROM ${quoteSqlTableReference(input.tableName)}`,
          input.maxRows,
        ),
      );
      continue;
    }

    bindPythonGlobal(pyodide, input.name, requestHostSchema(input.tableName));
  }
}

function bindPythonGlobal(pyodide: PyodideAPI, name: string, value: unknown) {
  pyodide.globals.set('__sqlrooms_bound_input_name', name);
  pyodide.globals.set('__sqlrooms_bound_input_value', value);
  pyodide.runPython(`
__sqlrooms_value = __sqlrooms_bound_input_value
if hasattr(__sqlrooms_value, "to_py"):
    __sqlrooms_value = __sqlrooms_value.to_py()
globals()[str(__sqlrooms_bound_input_name)] = __sqlrooms_value
globals().pop("__sqlrooms_value", None)
globals().pop("__sqlrooms_bound_input_name", None)
globals().pop("__sqlrooms_bound_input_value", None)
`);
}

function quoteSqlIdentifier(identifier: string) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function quoteSqlTableReference(tableName: string) {
  const parts = splitSqlIdentifierSegments(tableName);
  if (!parts?.length) return quoteSqlIdentifier(tableName);
  return parts.map(quoteSqlIdentifier).join('.');
}

function splitSqlIdentifierSegments(qualifiedName: string) {
  const parts: string[] = [];
  let current = '';
  let inQuotedIdentifier = false;
  let sawQuotedIdentifier = false;

  for (let index = 0; index < qualifiedName.length; index += 1) {
    const character = qualifiedName[index];
    if (inQuotedIdentifier) {
      if (character === '"') {
        if (qualifiedName[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          inQuotedIdentifier = false;
        }
        continue;
      }
      current += character;
      continue;
    }

    if (character === '"') {
      if (current.trim().length > 0) return undefined;
      inQuotedIdentifier = true;
      sawQuotedIdentifier = true;
      continue;
    }

    if (character === '.') {
      const part = sawQuotedIdentifier ? current : current.trim();
      if (!part) return undefined;
      parts.push(part);
      current = '';
      sawQuotedIdentifier = false;
      continue;
    }

    current += character;
  }

  if (inQuotedIdentifier) return undefined;
  const part = sawQuotedIdentifier ? current : current.trim();
  if (!part) return undefined;
  parts.push(part);
  return parts.length > 3 ? undefined : parts;
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
  outputDeclarations: PythonCellOutputDeclaration[],
): PythonExecutionOutput[] {
  const hasResult = pyodide.runPython('"result" in globals()');
  const declaredOutputs = outputDeclarations.map((output) => ({
    type: output.type,
    name: output.name,
  }));
  if (!hasResult && declaredOutputs.length === 0) return [];

  pyodide.globals.set('__sqlrooms_output_declarations', declaredOutputs);

  const outputsJson = pyodide.runPython(`
import json as __sqlrooms_json
import math as __sqlrooms_math

if hasattr(__sqlrooms_output_declarations, "to_py"):
    __sqlrooms_output_declarations = __sqlrooms_output_declarations.to_py()

def __sqlrooms_is_mapping(value):
    return hasattr(value, "keys") and hasattr(value, "__getitem__")

def __sqlrooms_is_vegalite_spec(value):
    if not isinstance(value, dict):
        return False
    schema = str(value.get("$schema", "")).lower()
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
    except TypeError:
        return None
    except Exception:
        return None

def __sqlrooms_json_safe(value):
    if isinstance(value, float):
        return value if __sqlrooms_math.isfinite(value) else None
    if isinstance(value, dict):
        return {str(key): __sqlrooms_json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [__sqlrooms_json_safe(item) for item in value]
    return value

def __sqlrooms_mimebundle_for(value):
    repr_mimebundle = getattr(value, "_repr_mimebundle_", None)
    if repr_mimebundle is None:
        return None
    bundle = __sqlrooms_safe_call(repr_mimebundle)
    if isinstance(bundle, tuple) and bundle:
        bundle = bundle[0]
    return bundle if isinstance(bundle, dict) else None

def __sqlrooms_output_for(name, value, declared_type=None):
    if declared_type == "text":
        return {"type": "text", "name": name, "text": str(value)}
    if declared_type == "markdown":
        return {"type": "markdown", "name": name, "markdown": str(value)}
    if declared_type == "html":
        if isinstance(value, str):
            return {"type": "html", "name": name, "html": value}
        repr_html = getattr(value, "_repr_html_", None)
        if repr_html is not None:
            html = __sqlrooms_safe_call(repr_html)
            if html:
                return {"type": "html", "name": name, "html": str(html)}
        return {"type": "html", "name": name, "html": str(value)}
    if declared_type == "json":
        return {"type": "json", "name": name, "value": __sqlrooms_json_safe(value)}
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
                    return {"type": "vega-lite", "name": name, "spec": __sqlrooms_json_safe(dict(spec))}

    to_dict = getattr(value, "to_dict", None)
    if to_dict is not None:
        spec = __sqlrooms_safe_call(to_dict)
        if __sqlrooms_is_mapping(spec):
            spec = dict(spec)
            if __sqlrooms_is_vegalite_spec(spec):
                return {"type": "vega-lite", "name": name, "spec": __sqlrooms_json_safe(spec)}

    if declared_type == "vega-lite" and __sqlrooms_is_mapping(value):
        return {"type": "vega-lite", "name": name, "spec": __sqlrooms_json_safe(dict(value))}

    if bundle:
        html = bundle.get("text/html")
        if html:
            return {"type": "html", "name": name, "html": str(html)}
        text = bundle.get("text/plain")
        if text:
            return {"type": "text", "name": name, "text": str(text)}

    repr_html = getattr(value, "_repr_html_", None)
    if repr_html is not None:
        html = __sqlrooms_safe_call(repr_html)
        if html:
            return {"type": "html", "name": name, "html": str(html)}

    return {"type": "json", "name": name, "value": __sqlrooms_json_safe(value)}

__sqlrooms_outputs = []
__sqlrooms_seen_output_names = set()
for __sqlrooms_declaration in __sqlrooms_output_declarations:
    __sqlrooms_name = __sqlrooms_declaration.get("name")
    if __sqlrooms_name in globals():
        __sqlrooms_seen_output_names.add(__sqlrooms_name)
        __sqlrooms_outputs.append(
            __sqlrooms_output_for(
                __sqlrooms_name,
                globals()[__sqlrooms_name],
                __sqlrooms_declaration.get("type"),
            )
        )

if "result" in globals() and "result" not in __sqlrooms_seen_output_names:
    __sqlrooms_outputs.append(__sqlrooms_output_for("result", result))

__sqlrooms_json.dumps(__sqlrooms_json_safe(__sqlrooms_outputs), default=str, allow_nan=False)
`);
  pyodide.runPython('globals().pop("__sqlrooms_output_declarations", None)');
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

function errorSummary(error: unknown) {
  return {
    name: error instanceof Error ? error.name : undefined,
    message:
      error instanceof Error ? error.message : 'Python execution failed.',
    traceback: error instanceof Error ? error.stack : undefined,
  };
}
