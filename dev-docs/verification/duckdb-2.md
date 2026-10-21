# DuckDB 2.0 compatibility verification

Date: 2026-10-21. Implementation base: `914fd9723` (`origin/main`, fetched before
branching). This covers phase 1 of the DuckDB/Quack adoption plan. No Quack
endpoint or browser transport replacement is included.

## Tested matrix

| Component                   | Version                                                          | Verification                                                                          |
| --------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Host                        | macOS 14.6.1, arm64                                              | Local native and Chromium checks                                                      |
| Python                      | CPython 3.12.9                                                   | Two isolated environments with matching dependencies                                  |
| Native baseline / candidate | DuckDB 1.5.6 / 2.0.0                                             | Python suites, serialized ASTs, existing runtime benchmark                            |
| Older Python reader         | DuckDB 1.4.4 and 1.5.6                                           | Copied old workspace, new runtime workspace and attached metadata after close         |
| Node                        | Node 24.19.0; `@duckdb/node-api` 1.4.4-r.3, engine 1.4.4         | Read runtime-created compatible file; DuckDB package tests                            |
| WASM                        | `@duckdb/duckdb-wasm` 1.32.0, engine 1.4.3                       | Actual pinned WASM EH build opens runtime-created file and reads user/metadata tables |
| Arrow                       | Python PyArrow 26.0.0 / JS apache-arrow 17.0.0                   | IPC scalar/nested conversion and connector tests                                      |
| Default extensions          | core_functions, icu, json, parquet `v2.0.0`; httpfs `77392a7207` | Native extension inventory; explicit httpfs install/load with storage policy          |

Python's declared minimum is now 3.11, as required by the 2.0 Python wheel. Both
Python workspace members and Roomie declare it. Linux/Python 3.12 remains the
repository's CI target; this local run does not establish Linux or Windows
results. Native credential handling is POSIX-only. Python 3.11, other Python
versions/platforms, community extensions and the RAG embedding/VSS pipeline
still require their release checks. The RAG manifest follows the workspace's
engine constraint; its complete application workflow was not tested here.

## Verification performed

- Built all 50 workspace packages before application builds. Built SQLRooms and
  Roomie's production UI bundles.
- SQLRooms Python suite: 339 passed, one optional cross-engine test skipped in
  the full run. Subsequent focused launcher/compatibility run: 70 passed, with
  the older reader enabled. The added sync-restart test also passes in the
  final nine-test compatibility suite. Roomie Python suite: 43 passed.
- SQLRooms UI: 40 suites / 226 tests and 3 snapshots passed, including real MCP
  clients. Roomie UI: 9 suites / 82 tests passed.
- DuckDB core: 10 suites / 100 tests; DuckDB connector: 43 tests; AI: 48 tests;
  HTML runtime: 32 tests; MCP: 30 tests passed. Real released-parser contract:
  16 tests against each of 1.5.6 and 2.0.0. New shared predicate tests include
  malformed parser results, unknown nodes, nested writes and set operations.
- Authenticated HTTP project queries reject INSERT/UPDATE/DELETE CTEs without
  changing the source table. Ordinary SELECT and UNION results remain usable.
- CSV/JSON/Parquet imports, filenames containing spaces/apostrophes, attached
  metadata, both metadata namespaces, JSON document payloads, CRDT snapshots,
  checkpoint/reopen, cancellation and runtime ownership use disposable files.
  The original old-engine fixture remains byte-for-byte unchanged while its
  copy is exercised by the candidate engine.
- Chromium: both applications boot without page errors. SQLRooms creates a
  document and imports the cars CSV with a four-row table explorer. Roomie
  previews/imports the same CSV, creates a count plot, renders the Mosaic chart,
  restores it after reload, renders a paginated four-row table block, and
  renders an HTML-app iframe. HTML read-query admission and mutation rejection
  are covered by the runtime tests; this is not an exhaustive HTML app suite.
- Optional SQLRooms sync: two authenticated clients join the same room, exchange
  a Loro binary update, and verify the debounced snapshot in DuckDB. A focused
  test restarts the runtime and hydrates the saved Loro data.
- SQLRooms wheel and sdist pass the existing clean-install/distribution
  verifier, including rebuilt sdist, bundled assets, authenticated WebSocket
  execution and checkpointed data. Roomie's complete wheel passes its verifier;
  both wheels install together in a fresh environment and pass Roomie startup,
  asset serving, authenticated SQL and file-persistence checks.
- Changed Python files pass Ruff's `E4,E7,E9,F` checks. The unrestricted local
  Ruff run also reports pre-existing repository style/security findings; those
  were not mixed into this engine migration. `git diff --check` passes.
- ESLint passes for all six affected packages (existing warnings remain), and
  changed TypeScript files pass Prettier. The local pre-commit script prepends
  Volta's Node 22, contradicting the repository's Node 24 requirement, so these
  checks ran explicitly with Node 24 before committing without that hook.

## SQL AST and migration audit

Released 2.0's default AST contains structured function/window `arguments` and
qualified-name paths. With storage compatibility set to `v1.4.0`, those function
expressions use legacy `children`. Existing dependency extraction and source
policy already traverse arbitrary object values, so no AST translation or
temporary global serialization setting is needed.

The new `isReadOnlySqlSelect` primitive is shared by the AI read-only query tool,
MCP, HTML apps, Python SQL bridge and table materialization. The HTTP endpoint
uses the same structural rule in Python. SQL editor execution retains write
authority, classifying mutation CTEs as writes. Notebook execution also retains
its existing write/materialization authority. Query previews and HTML query
execution wrap SQL as a subquery; this is not a substitute for the explicit
read-only guard on protected consumers.

The 2.0 Python API removed relation `fetchone()` and changed open-result
semantics. The import regression now uses the connection result and consumes
it before further relation work. Native Arrow export already uses relations,
and the runtime already owns a cursor per operation.

Migration checks cover Python-style lambdas, single-arrow rejection, division
and modulo by zero, TRY fallback, mixed-case identifiers and extension loading.
No generated single-arrow lambdas, removed profiling settings, or legacy S3
credential query parameters were found in repository SQL. User-stored SQL is
not silently rewritten; see the package migration guidance.

## Storage and result policy

New runtime files use explicit `v1.4.0` storage compatibility. Existing files
retain their format, including existing 2.0 files, which are still unreadable by
older engines. Tests prove old readers reject a native-default 2.0 file. File
compatibility does not imply support for newer types/features: the tested
portable subset includes existing tables/metadata and ordinary scalar/nested
values. Retain pre-upgrade copies for rollback.

Arrow preserves NULL, decimal scale, timestamp microseconds and nested values.
VARIANT's raw Arrow extension bytes are rejected recursively, including list,
struct and map nesting, with explicit JSON/concrete-type cast guidance. The
failure leaves the query connection usable. The legacy pandas JSON endpoint
retains its millisecond timestamp/number decimal behavior.

## Runtime benchmark

The existing benchmark ran three launches per engine on the same development
host and generated datasets. Initial baseline setup costs and a warm-setup
baseline are both retained in [the raw runs](duckdb-2-benchmarks.json). No
transport changes were made. Desktop load was not isolated; these measurements
are compatibility smoke evidence, not a performance adoption claim.

| Metric, median (min–max)       | 1.5.6, warm setup    | 2.0.0               |
| ------------------------------ | -------------------- | ------------------- |
| Startup ms                     | 681.2 (675.2–1028.6) | 677.4 (634.5–677.8) |
| Cold query ms                  | 4.02 (2.92–4.42)     | 5.01 (4.85–5.66)    |
| Warm query ms                  | 2.32 (2.29–3.45)     | 2.13 (2.10–2.17)    |
| Eight concurrent queries ms    | 8.86 (7.11–11.94)    | 6.97 (6.90–8.15)    |
| 1M-row result ms               | 206.6 (201.9–213.0)  | 207.7 (204.2–208.2) |
| 1M-row Arrow upload ms         | 252.3 (178.0–258.1)  | 15.36 (13.51–15.54) |
| Cancellation acknowledgment ms | 0.66 (0.42–0.73)     | 0.43 (0.40–0.67)    |
| Peak server RSS MiB            | 398.6 (389.5–410.2)  | 398.7 (395.6–410.0) |

Cancellation acknowledgment measures the response, not proof that a mutation
rolled back. Payload sizes differ slightly with Arrow batching. The upload
difference needs a dedicated controlled benchmark before making a performance
claim. Patch-release and publication decisions remain separate release gates.

References: [DuckDB 2.0 migration](https://duckdb.org/docs/2.0/operations_manual/migration),
[Python migration](https://duckdb.org/docs/2.0/clients/python/migration),
[storage](https://duckdb.org/docs/2.0/internals/storage), and
[package compatibility policy](../../python/sqlrooms/DUCKDB_COMPATIBILITY.md).
