# Node / Quack / DuckDB-Wasm feasibility experiment

Isolated, localhost-only experiment. No production Roomie code, dependency pins,
workspace lockfile, or query policies are changed. Synthetic sales data only.

## Result (2026-10-22)

**The remote browser histogram works with rebuilt extensions and one query thread.
Published extension binaries still fail.**

See [the threaded investigation](THREADED-INVESTIGATION.md) for the working build
recipe, a minimal reproducer, and upstream issue references.

- Node embeds DuckDB v2.0.0 and successfully starts/stops `quack_serve`.
- A second native DuckDB instance connects over HTTP Quack, rejects an invalid
  token, and queries the server-owned table: 120 rows, total 12960. This is an
  actual remote connection, not a query on the server's local connection.
- The published `@duckdb/duckdb-wasm@1.33.1-dev110.0` executes SQL in the browser, but is
  stamped `v2.0.0-dev88614` / extension ABI `d54cbbe3df`. Its source commit is
  exactly the official v2.0.0 tag. Strict extension loading rejects released
  v2.0.0 extensions because of that metadata mismatch.
- The explicit single-thread compatibility experiment loads the pinned official
  extensions, then `ATTACH` fails with `thread constructor failed: Not supported`.
  Upstream Quack's `ConnectToServer` calls `StartHeartbeat` unconditionally.
- The threaded artifact reports `wasm_threads`, but its matching released httpfs
  extension fails dynamic loading. Instrumentation reveals a non-shared memory
  import incompatible with the threaded runtime; the public error omits this detail.
- The separate browser-local control successfully renders the shared Roomie
  histogram (nine bins) from this v2 Wasm build. Browser evidence shows real Arrow
  results (`Float64` bin bounds, `Int64` counts) feeding the existing renderer.

The locally rebuilt pair successfully renders nine histogram bins from native
server-owned data through Quack and Arrow. This establishes feasibility, while a
compatible signed distribution and full Roomie integration remain outstanding.

## Published npm package retest (2026-10-22)

Downloaded the package directly from npm and reran the browser fixture in a fresh
Chrome context with COOP/COEP enabled. Its base/threaded Wasm binaries, browser
wrapper, and worker scripts are byte-for-byte identical to the original CI
artifact. Publication does not change the observed compatibility failures.

| Test                                                            | Result                                                                                   |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Native smoke                                                    | PASS: server-owned 120 rows, total 12960; invalid token rejected                         |
| Strict single-thread remote                                     | FAIL: released extension requires `v2.0.0`, browser ABI is `d54cbbe3df`                  |
| Single-thread `ci-compat`                                       | FAIL at `ATTACH`: `thread constructor failed: Not supported`                             |
| Threaded `ci-compat`                                            | FAIL loading released `wasm_threads/httpfs`; underlying error detail empty               |
| Browser-local chart control                                     | PASS: nine bins, Arrow `Float64` bounds and `Int64` counts; visually verified            |
| Default `INSTALL quack; LOAD quack` in a fresh browser database | FAIL: default `d54cbbe3df/wasm_eh/quack.duckdb_extension.wasm` endpoint returns HTTP 404 |

This table records the published artifacts. The subsequent source rebuild
succeeded for the remote histogram, as documented in the threaded investigation.
Browser tests used the existing built workspace packages in the original checkout;
full Roomie application integration remains untested.

## Reproduce

From the repository root, with its normal dependencies installed:

```sh
pnpm build
npm ci --prefix experiments/quack-node-wasm --workspaces=false --ignore-scripts
bash experiments/quack-node-wasm/prepare-vendor.sh
node experiments/quack-node-wasm/native-smoke.mjs
node experiments/quack-node-wasm/server.mjs
```

The download script requires `curl`, `tar`, and `shasum`. It downloads the exact
published npm tarball and verifies SHA-256 checksums before extraction. No GitHub
authentication or expiring CI artifact is required. Dependencies/artifacts stay
inside this directory; generated files are ignored by Git.

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
checksum-pinned official extensions unless `rebuilt=1` explicitly selects local
unsigned builds; default mode leaves checks enabled.

The chart fixture uses Roomie's shared `createHistogramSpec` and `VgPlotChart`
renderer plus SQLRooms' Arrow-to-Mosaic bridge. It is not a full Roomie document
or application integration. One persistent Wasm connection is deliberately used
so `CONNECT remote_db` applies to every chart query.

## Exact versions and sources

| Component                           | Tested identity                                                     |
| ----------------------------------- | ------------------------------------------------------------------- |
| Host                                | macOS arm64, Node v24.18.0                                          |
| Node binding                        | `@duckdb/node-api` and bindings `2.0.0-r.1` (isolated npm lockfile) |
| Native engine                       | `SELECT version()` → `v2.0.0`                                       |
| Native Quack / httpfs               | `f96420ed46` / `77392a7207`                                         |
| Wasm wrapper                        | `1.33.1-dev110.0`                                                   |
| Wasm engine                         | `SELECT version()` → `v2.0.0-dev88614`                              |
| Wasm source commit                  | `5beed055bc9fe21eba58207794e0bd271e100ade`                          |
| Embedded engine commit / v2.0.0 tag | `d54cbbe3df17e8e5ce68312f483b4155836112aa`                          |
| Package                             | `@duckdb/duckdb-wasm@1.33.1-dev110.0` from npm                      |
| Browser Arrow                       | Apache Arrow 17 via Wasm; existing SQLRooms bridge for Mosaic       |

Sources: [published package](https://www.npmjs.com/package/@duckdb/duckdb-wasm/v/1.33.1-dev110.0),
[original Wasm CI run](https://github.com/duckdb/duckdb-wasm/actions/runs/39574076930),
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

This experiment demonstrates Node hosting and remote browser chart feasibility.
Before adopting Quack as Roomie’s browser query transport:

- Obtain a compatible v2 Wasm/extension build that loads with normal verification
  enabled and successfully connects to the Node-owned database.
- Test the full Roomie document path, connection initialization, and Mosaic cache
  schemas; the isolated remote histogram is now verified.
- Verify type fidelity (including empty results), cancellation, reconnects,
  concurrent agent/browser queries, and server-side query restrictions.
- Measure browser startup and memory costs against the existing WebSocket path.

Keep this fixture independent of production connector selection and headless
workspace implementation. The chart proof does not resolve those tasks.
