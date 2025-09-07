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
  } = options;

  let pyodide: any | null = providedPyodide ?? (globalThis as any).pyodide ?? null;
  let pyConn: any | null = null;

  const impl: BaseDuckDbConnectorImpl = {
    async initializeInternal() {
      if (!pyodide) {
        pyodide = (globalThis as any).pyodide;
      }
      if (!pyodide) {
        throw new Error('Pyodide instance not available. Pass via options.pyodide or ensure globalThis.pyodide is set.');
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

    async executeQueryInternal(query: string, signal: AbortSignal): Promise<arrow.Table> {
      if (!pyodide || !pyConn) {
        throw new Error('Pyodide DuckDB not initialized');
      }

      if (signal.aborted) {
        throw new DOMException('Query was cancelled', 'AbortError');
      }

      // We use Arrow IPC to transfer results from Pyodide to JS efficiently
      // Requires pyarrow in the Pyodide environment
      const py = `
import io
import pyarrow as pa
tbl = con.execute(r"""${query.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}""").arrow()
sink = io.BytesIO()
with pa.ipc.new_file(sink, tbl.schema) as writer:
  writer.write_table(tbl)
sink.getvalue()
`;

      const proxy = await pyodide.runPythonAsync(py);
      try {
        // Convert Python bytes to Uint8Array
        const buffer: Uint8Array = proxy.toJs({create_proxies: false});
        return arrow.tableFromIPC(buffer);
      } finally {
        proxy.destroy?.();
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

