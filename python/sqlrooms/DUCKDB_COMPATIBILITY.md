# DuckDB 2.0 compatibility

SQLRooms and Roomie use the same native Python runtime, with
`duckdb>=2.0.0,<2.1.0` and Python **3.11 or newer**. DuckDB 2.0 does not support
Python 3.10 or free-threaded CPython. The browser WASM and Node connectors have
independent engine versions; upgrading Python does not upgrade those clients.
Quack is not enabled by this upgrade.

## Workspace files and rollback

The shared runtime opens DuckDB with
`config={"storage_compatibility_version": "v1.4.0"}`. This keeps **new** workspace
files and newly attached metadata files on a format readable by the pinned
DuckDB-WASM 1.4 engine. Existing files keep their storage version. Opening a 2.0
format file with this setting does not downgrade it.

File compatibility is not feature compatibility: a type, extension, macro or SQL
feature introduced after 1.4 may still be unsupported by an older reader. New
2.0-only persisted features are outside this compatibility policy. Do not raise
the storage version merely to change SQL AST serialization.

Save and close the old application before copying its workspace file and uploads
directory. Test the copy with the new runtime and retain the original for
rollback. Stop all writers before switching engines. An older engine cannot open
a database newly created by an unconfigured DuckDB 2.0 process, whose default
format is 2.0; restore the pre-upgrade copy instead. For an intentional file
conversion, use DuckDB's documented export/import or copy-to-compatible-file
workflow, checking the stored types and extensions as well as the file format.

## SQL and result contracts

- Read-only consumers validate the entire serialized query tree. A top-level
  SELECT can contain an INSERT, UPDATE or DELETE CTE in 2.0. Unknown query-node
  kinds are rejected. The normal SQL editor still permits writes and classifies
  these queries as writes for cancellation warnings.
- Both legacy `children` and 2.0 `arguments` expression trees are traversed.
  SQLRooms does not rewrite DuckDB's internal AST schema or change database
  storage settings just for parsing. The shared structural guard is not a
  sandbox: functions, macros, views and file access need the host's source policy.
- Arrow preserves nulls, decimal scale, microsecond timestamps and nested values.
  Native `VARIANT` has an Arrow extension encoding the current JS Arrow client
  cannot decode. Raw or nested VARIANT results fail with guidance to cast to JSON
  or a concrete SQL type; no silent stringification or byte-struct rendering is
  substituted. `SELECT value::JSON FROM ...` is the explicit display fallback.
- The legacy server JSON endpoint still uses pandas: timestamps are epoch
  milliseconds and decimal values become JSON numbers. The browser connector's
  `queryJson` uses Arrow conversion, preserving decimals as strings.
- Stored queries must use `lambda x: ...`, replacing single-arrow lambdas.
  Integer division/modulo by zero now raises; use `TRY(...)` for NULL semantics.
  Identifier case is preserved by default. No repository-generated single-arrow
  lambdas or removed profiling settings were found in the implementation audit.
- Extensions must match the native engine. The default `httpfs` is installed for
  2.0 independently of WASM assets. Optional/community extension availability
  must be checked before relying on a workspace that uses them.

## Verification and supported combinations

The implementation record and exact tested versions are in
[`dev-docs/verification/duckdb-2.md`](https://github.com/sqlrooms/sqlrooms/blob/main/dev-docs/verification/duckdb-2.md).
Native macOS arm64/Python 3.12 is the local verification platform. The Python
workflow exercises Linux/Python 3.12 and an isolated 1.4.4 reader. Other platforms
and optional extensions require release checks; they are not established by a
successful dependency resolution. The independent RAG application's full
embedding/VSS pipeline is not part of the SQLRooms/Roomie compatibility gate.

To repeat the focused tests, point `DUCKDB_COMPAT_PYTHON` at a separate interpreter
with DuckDB 1.4.4 or 1.5.6 installed and run:

```sh
DUCKDB_COMPAT_PYTHON=/path/to/older/python uv run --package sqlrooms pytest sqlrooms/tests/server/test_duckdb_compatibility.py
DUCKDB_TEST_PYTHON="$PWD/.venv/bin/python" pnpm --filter @sqlrooms/mcp test --runInBand localSqlPolicy.duckdb
```

The file test creates a disposable old workspace, copies it, upgrades only the
copy, checks old readers after checkpoint/close, and confirms default 2.0 files
are rejected by the old engine. It never opens a user's workspace.

References: [engine migration](https://duckdb.org/docs/2.0/operations_manual/migration),
[Python migration](https://duckdb.org/docs/2.0/clients/python/migration),
[storage compatibility](https://duckdb.org/docs/2.0/internals/storage).
