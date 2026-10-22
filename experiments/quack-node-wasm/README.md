# Node / Quack / DuckDB-Wasm feasibility experiment

Isolated, localhost-only experiment. No production Roomie code, dependency pins,
workspace lockfile, or query policies are changed. Synthetic sales data only.

## Result (2026-10-22)

**Native Node hosting works; the requested remote browser chart is not yet verified.**

- Node embeds DuckDB v2.0.0 and successfully starts/stops `quack_serve`.
- A second native DuckDB instance connects over HTTP Quack, rejects an invalid
  token, and queries the server-owned table: 120 rows, total 12960. This is an
  actual remote connection, not a query on the server's local connection.
- The upstream unpublished v2 Wasm artifact executes SQL in the browser, but is
  stamped `v2.0.0-dev88614` / extension ABI `d54cbbe3df`. Its source commit is
  exactly the official v2.0.0 tag. Strict extension loading rejects released
  v2.0.0 extensions because of that metadata mismatch.
- The explicit single-thread compatibility experiment loads the pinned official
  extensions, then `ATTACH` fails with `thread constructor failed: Not supported`.
  Upstream Quack's `ConnectToServer` calls `StartHeartbeat` unconditionally.
- The threaded artifact reports `wasm_threads`, but its matching released httpfs
  extension fails dynamic loading with an empty underlying loader message.
  The precise threaded dynamic-loader cause is not established.
- The separate browser-local control successfully renders the shared Roomie
  histogram (nine bins) from this v2 Wasm build. Browser evidence shows real Arrow
  results (`Float64` bin bounds, `Int64` counts) feeding the existing renderer.
  Screenshot: `.runtime/local-control.png` (generated, not committed).

Do not infer end-to-end Quack browser compatibility or production readiness from
the successful native test. A compatible published Wasm/extension pair, or a
coordinated upstream build, is the next requirement.

## Reproduce

From the repository root, with its normal dependencies installed:

```sh
pnpm build
npm ci --prefix experiments/quack-node-wasm --workspaces=false --ignore-scripts
bash experiments/quack-node-wasm/prepare-vendor.sh
node experiments/quack-node-wasm/native-smoke.mjs
node experiments/quack-node-wasm/server.mjs
```

The download script requires `gh` authentication, `curl`, `unzip`, and `shasum`.
It verifies SHA-256 checksums before extracting the upstream CI artifact. GitHub
CI artifacts eventually expire; this fixture deliberately fails rather than
silently replacing the tested build. Dependencies/artifacts stay inside this
directory; generated files are ignored by Git.

Browser modes:

- `http://127.0.0.1:4317/`: strict remote test, currently fails extension metadata.
- `http://127.0.0.1:4317/?ci-compat=1`: explicit compatibility experiment,
  currently fails when Quack starts a thread.
- `http://127.0.0.1:4317/?local-control=1`: separate browser-local rendering
  control. Its chart is **not evidence of remote Quack execution**.
- Thread experiment: stop the server, run
  `POC_THREADS=1 node experiments/quack-node-wasm/server.mjs`, then open
  `http://127.0.0.1:4317/?ci-compat=1&threads=1`. This adds COOP/COEP headers.

Use Ctrl-C to stop the server. Ports are 4317 (Vite), 19494 (Quack), and 19495
(native smoke test). Do not run multiple copies concurrently.

**`ci-compat` relaxes both signature and metadata checks only in the experiment's
browser-local DuckDB instance.** Upstream's Wasm loader requires both flags for a
metadata mismatch. This is not a deployment recommendation. It loads only the
checksum-pinned official extensions here; default mode leaves checks enabled.

The chart fixture uses Roomie's shared `createHistogramSpec` and `VgPlotChart`
renderer plus SQLRooms' Arrow-to-Mosaic bridge. It is not a full Roomie document
or application integration. One persistent Wasm connection is deliberately used
so `CONNECT remote_db` applies to every chart query.

## Exact versions and sources

| Component                           | Tested identity                                                            |
| ----------------------------------- | -------------------------------------------------------------------------- |
| Host                                | macOS arm64, Node v24.18.0                                                 |
| Node binding                        | `@duckdb/node-api` and bindings `2.0.0-r.1` (isolated npm lockfile)        |
| Native engine                       | `SELECT version()` → `v2.0.0`                                              |
| Native Quack / httpfs               | `f96420ed46` / `77392a7207`                                                |
| Wasm wrapper                        | `1.33.1-dev110.0`                                                          |
| Wasm engine                         | `SELECT version()` → `v2.0.0-dev88614`                                     |
| Wasm source commit                  | `5beed055bc9fe21eba58207794e0bd271e100ade`                                 |
| Embedded engine commit / v2.0.0 tag | `d54cbbe3df17e8e5ce68312f483b4155836112aa`                                 |
| Artifact                            | `duckdb-wasm-packages-loadable`, run `39574076930`, artifact `12334523013` |
| Browser Arrow                       | Apache Arrow 17 via Wasm; existing SQLRooms bridge for Mosaic              |

Sources: [Wasm CI run](https://github.com/duckdb/duckdb-wasm/actions/runs/39574076930),
[v2.0.0 source](https://github.com/duckdb/duckdb/tree/v2.0.0),
[Wasm extension loader](https://github.com/duckdb/duckdb-wasm/blob/5beed055bc9fe21eba58207794e0bd271e100ade/lib/src/extension_provider.cc),
[Quack client heartbeat](https://github.com/duckdb/duckdb-quack/blob/f96420ed46aee9c42064bdb99ddfd1230d6c0086/src/quack_client.cpp).

[SQLRooms PR #959](https://github.com/sqlrooms/sqlrooms/pull/959), inspected at
`8eb7a853ab98fa6c1dda6b7ac7832851fee0772f`, upgrades Python to 2.0.0 while retaining
older Node/Wasm clients. This experiment PR is stacked on that branch; the
experiment keeps its Node v2 dependency isolated from the workspace pins.

Validation during the original experiment on `main`: all 50 workspace packages
built successfully; isolated dependency install audited 5 packages with no
reported vulnerabilities; native smoke passed; all vendor checksums passed.
The fixture was then copied onto #959 for this draft; the full workspace build
was not repeated on that base. JavaScript and shell syntax checks passed in the
stacked worktree. No older engine was substituted for this experiment.

## Implementation-plan checkpoints

This experiment supports choosing Node as a native Quack host. It does not yet
support choosing Quack as Roomie’s browser query transport. Before that decision:

- Obtain a compatible v2 Wasm/extension build that loads with normal verification
  enabled and successfully connects to the Node-owned database.
- Render this histogram from server-owned rows, then test the full Roomie
  document path, connection initialization, and Mosaic cache schemas.
- Verify type fidelity (including empty results), cancellation, reconnects,
  concurrent agent/browser queries, and server-side query restrictions.
- Measure browser startup and memory costs against the existing WebSocket path.

Keep this fixture independent of production connector selection and headless
workspace implementation. Native hosting success does not resolve those tasks.
