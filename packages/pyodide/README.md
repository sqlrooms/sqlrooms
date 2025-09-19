This package integrates DuckDB running inside Pyodide with SQLRooms.

It exposes a `createPyodideDuckDbConnector` function that provides the `DuckDbConnector` interface backed by Pyodide.

Notes:
- You must initialize Pyodide and install the `duckdb` Python package inside the Pyodide environment before using the connector.
- Query results are returned as Arrow tables via Arrow IPC (pyarrow required) or via `to_arrow_table()` if available.

Example usage will be added to the examples once stabilized.

