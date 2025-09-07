import * as arrow from 'apache-arrow';
import {
  BaseDuckDbConnectorImpl,
  createBaseDuckDbConnector,
  DuckDbConnector,
} from '@sqlrooms/duckdb';

/**
 * Literal type tag identifying the Pyodide-backed DuckDB connector.
 */
export type PyodideDuckDbConnectorType = 'pyodide';

/**
 * Options to configure the Pyodide DuckDB connector.
 */
export interface PyodideDuckDbConnectorOptions {
  /** SQL string executed after the connection is initialized. */
  initializationQuery?: string;
  /** Name of the Python module to import for DuckDB. Defaults to 'duckdb'. */
  duckdbModuleName?: string;
  /** Optional Python code executed during initialization (e.g., package installs). */
  initializationPy?: string;
  /** Explicit Pyodide instance. If omitted, uses globalThis.pyodide. */
  pyodide?: any;
  /**
   * Base URL for Pyodide packages when we initialize via ESM import.
   * Defaults to the public CDN matching the example app.
   * Example: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full'
   */
  indexURL?: string;
}

/**
 * DuckDB connector implementation that runs inside a Pyodide environment.
 *
 * It conforms to the `DuckDbConnector` interface so it can be plugged into
 * SQLRooms seamlessly. Queries are executed in Python via DuckDB and results
 * are transferred as Arrow IPC to JavaScript.
 */
export interface PyodideDuckDbConnector extends DuckDbConnector {
  /** Returns the underlying Pyodide instance. */
  getPyodide(): any;
  /** Returns the Python-side DuckDB connection proxy. */
  getPyDuckDbConn(): any;
  /** Connector type tag. */
  readonly type: PyodideDuckDbConnectorType;
}

/**
 * Create a DuckDB connector backed by Pyodide.
 *
 * Requirements on the Pyodide side:
 * - `duckdb` Python package installed in the environment
 * - `pyarrow` Python package available for Arrow IPC
 */
/**
 * Create a DuckDB connector backed by Pyodide.
 *
 * Requirements in the Pyodide environment:
 * - Python packages `duckdb` and `pyarrow` must be available
 * - Provide a Pyodide instance or ensure `globalThis.pyodide` is set
 */
export function createPyodideDuckDbConnector(
  options: PyodideDuckDbConnectorOptions = {},
): PyodideDuckDbConnector {
  const {
    initializationQuery = '',
    duckdbModuleName = 'duckdb',
    initializationPy,
    pyodide: providedPyodide,
    indexURL = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full',
  } = options;

  let pyodide: any | null =
    providedPyodide ?? (globalThis as any).pyodide ?? null;
  let pyConn: any | null = null;
  let havePyArrow = false;

  const impl: BaseDuckDbConnectorImpl = {
    async initializeInternal() {
      if (!pyodide) {
        pyodide = (globalThis as any).pyodide;
      }
      if (!pyodide) {
        // Try to initialize Pyodide if it hasn't been provided.
        // 1) Use global loadPyodide if the CDN script was included.
        const maybeLoadPyodide = (globalThis as any).loadPyodide;
        if (typeof maybeLoadPyodide === 'function') {
          try {
            pyodide = await maybeLoadPyodide({indexURL});
          } catch {}
        }

        // 2) Fall back to dynamic ESM import if available in the app.
        if (!pyodide) {
          try {
            // eslint-disable-next-line @typescript-eslint/consistent-type-imports
            const mod: any = await import('pyodide');
            if (typeof mod?.loadPyodide === 'function') {
              pyodide = await mod.loadPyodide({indexURL});
            }
          } catch {}
        }

        if (pyodide) {
          (globalThis as any).pyodide = pyodide;
        }
      }
      if (!pyodide) {
        throw new Error(
          'Pyodide instance not available. Provide options.pyodide, include the Pyodide CDN script, or install the pyodide package.',
        );
      }

      // Ensure required Python packages are available in the Pyodide environment.
      // The 'duckdb' wheel is part of Pyodide but must be explicitly loaded.
      // 'pyarrow' is required for Arrow IPC data transfer.
      if (typeof pyodide.loadPackage === 'function') {
        try {
          await pyodide.loadPackage(['duckdb', 'pyarrow']);
        } catch (_) {
          // Best-effort: if bulk load fails, try loading individually.
          try {
            await pyodide.loadPackage('duckdb');
          } catch {}
          try {
            await pyodide.loadPackage('pyarrow');
          } catch {
            // Some environments require 'pyarrow-core'
            try {
              await pyodide.loadPackage('pyarrow-core');
            } catch {}
          }
        }
      }

      // Verify that pyarrow is actually importable. If not, we will fallback to CSV transport.
      try {
        await pyodide.runPythonAsync('import pyarrow as pa');
        havePyArrow = true;
      } catch {
        havePyArrow = false;
      }

      if (initializationPy) {
        await pyodide.runPythonAsync(initializationPy);
      }

      const pyCode = `
import importlib
duckdb = importlib.import_module('${duckdbModuleName}')
try:
  import pyarrow as pa
  have_pa = True
except Exception:
  have_pa = False
con = duckdb.connect()
`;
      await pyodide.runPythonAsync(pyCode);
      pyConn = pyodide.globals.get('con');
    },

    async destroyInternal() {
      try {
        if (pyConn) {
          await pyodide.runPythonAsync('con.close()');
          pyConn = null;
        }
      } finally {
        // keep pyodide alive; user owns lifecycle
      }
    },

    async executeQueryInternal(
      query: string,
      signal: AbortSignal,
    ): Promise<arrow.Table> {
      if (!pyodide || !pyConn) {
        throw new Error('Pyodide DuckDB not initialized');
      }

      if (signal.aborted) {
        throw new DOMException('Query was cancelled', 'AbortError');
      }

      // Prefer Arrow IPC via pyarrow when available; otherwise, fallback to JSON transport.
      const py = havePyArrow
        ? `
import io
import pyarrow as pa
tbl = con.execute(r"""${query.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}""").arrow()
sink = io.BytesIO()
with pa.ipc.new_file(sink, tbl.schema) as writer:
  writer.write_table(tbl)
sink.getvalue()
`
        : `
import json
res = con.execute(r"""${query.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}""")
cols = [d[0] for d in res.description]
rows = res.fetchall()
data = [dict(zip(cols, row)) for row in rows]
json.dumps(data, default=str)
`;

      const result: any = await pyodide.runPythonAsync(py);
      const isPyProxy = !!result && typeof result.toJs === 'function';
      try {
        if (havePyArrow) {
          // Convert to Uint8Array for Arrow IPC
          let bytes: Uint8Array;
          if (isPyProxy) {
            bytes = result.toJs({create_proxies: false});
          } else if (result instanceof Uint8Array) {
            bytes = result;
          } else if (result instanceof ArrayBuffer) {
            bytes = new Uint8Array(result);
          } else if (ArrayBuffer.isView(result)) {
            bytes = new Uint8Array(result.buffer);
          } else {
            throw new Error('Expected Arrow IPC bytes from Pyodide');
          }
          return arrow.tableFromIPC(bytes);
        } else {
          // JSON array of records
          let jsonText: string;
          if (isPyProxy) {
            jsonText = result.toJs({create_proxies: false});
          } else if (typeof result === 'string') {
            jsonText = result;
          } else {
            jsonText = JSON.stringify(result);
          }
          const records = JSON.parse(jsonText);
          return arrow.tableFromJSON(records);
        }
      } finally {
        if (isPyProxy) {
          try {
            result.destroy?.();
          } catch {}
        }
      }
    },
  };

  const base = createBaseDuckDbConnector({initializationQuery}, impl);

  return {
    ...base,
    getPyodide() {
      if (!pyodide) throw new Error('Pyodide not available');
      return pyodide;
    },
    getPyDuckDbConn() {
      if (!pyConn) throw new Error('Pyodide DuckDB connection not initialized');
      return pyConn;
    },
    get type() {
      return 'pyodide' as const;
    },
  };
}

/**
 * Type guard for `PyodideDuckDbConnector`.
 */
export function isPyodideDuckDbConnector(
  connector: DuckDbConnector,
): connector is PyodideDuckDbConnector {
  return (connector as any).type === 'pyodide';
}
