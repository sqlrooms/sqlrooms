# Python runtime consolidation verification

Base: PR #927, fa077200d27e4cb1bf6d428ebed5013b8cc70fae.

## Contracts and consumers

Preserve JSON (`json`, `exec`), Arrow results (4-byte big-endian header length,
JSON header, IPC bytes), `uploadArrow`, query IDs/errors/cancel acknowledgements,
subscribe/notify, optional CRDT join/snapshot/binary broadcasts and persistence.
HTTP includes bootstrap/renewal, configuration, uploads, DB bridges, status,
managed lifecycle and workspace catalog. MCP tools remain browser-owned through
`/ws/mcp-bridge`; native lifecycle credentials remain distinct from page access.
Health/readiness reveal no workspace data. All data paths require credentials,
Host/Origin checks, expiry/revocation and binding checks.

Known consumers: Python CLI and agent connector; CLI UI; DuckDB query and sync
examples; development supervisors/Vite proxies; Sprite installer; publication,
wheel verification and Python CI. External standalone users are unknown.

## Performance acceptance (recorded before replacement)

Same machine, interpreter/dependencies, generated data and client; three process
launches, cold first query and ten warm queries separately. The baseline outer
Uvicorn and socketify shared compressor both enable compression (the old comment
claiming otherwise was incorrect); aiohttp requests permessage-deflate=15.
The first replacement comparison also enables permessage-deflate. Investigate median regressions
exceeding 25% plus 5ms for warm/dashboard latency, 25% plus 100ms for large
transfers/uploads, 25% plus 100MiB for peak RSS, and 25% plus 500ms for startup.
Cancellation acknowledgement and health must remain below 250ms under load.
These are engineering acceptance thresholds for this reproducible local sample,
not user-agreed production SLOs or a browser rendering benchmark.

## Results (September 20, 2026)

macOS 26.5.2 arm64, Python 3.12.11, DuckDB 1.5.3, PyArrow 23.0.1,
Uvicorn 0.38.0, websockets 16.0, FastAPI 0.136.3, Loro 1.10.3, MCP 2.0.0.
The actual browser is Codex's Chromium 153 in-app browser. Data is generated,
local and disposable. Each Python sample starts a fresh process; the browser
sample repeats three times in one process, so only its first iteration is cold.
All numbers below are medians of three samples, in milliseconds unless noted.
Raw samples live alongside this document as `python-consolidation-*.json`.

### Compression investigation and chosen settings

The initial like-for-like comparison enabled deflate on both implementations.
Single-result latency and memory improved, but three overlapping 44 MB Arrow
results blocked ASGI control traffic: median cancel acknowledgement was 2,615 ms
versus 1,300 ms on the baseline. Both exceeded the preselected 250 ms threshold.
Compression runs synchronously in the WebSocket driver's event loop. Disabling
it on the shared listener reduced cancellation to 0.35 ms and the worst sampled
health response to 42.1 ms. This is an intentional configuration change, not an
unexplained transport speedup. The compressed comparison is retained in the raw
`asgi-compressed` and `asgi-compressed-stress` files.

Final `UVICORN_OPTIONS` explicitly disables per-message deflate, uses one worker,
128 MiB incoming messages, four driver receive-queue entries, and 20-second ping
interval/timeout. Application queues additionally bound bytes, messages, active
connections, pending input and database operations. Turning compression back on
requires rechecking control latency. Disabling it increases network bytes; these
loopback results do not establish performance over a slow remote link.

| Python workload                                   | Base #927, compressed | Direct ASGI, compression off |
| ------------------------------------------------- | --------------------: | ---------------------------: |
| Startup to ready                                  |                 674.9 |                        527.2 |
| First query                                       |                  7.89 |                         2.11 |
| Warm query                                        |                  1.71 |                         1.38 |
| Eight overlapping queries                         |                  5.64 |                         5.25 |
| 44 MB Arrow result                                |               1,624.7 |                        142.8 |
| 8 MB Arrow upload                                 |                 760.6 |                        169.3 |
| Peak RSS, MiB                                     |                 514.1 |                        370.2 |
| Three 44 MB results, delayed reader               |               4,186.3 |                        749.6 |
| Cancel while those results run                    |               1,300.1 |                         0.35 |
| Maximum health latency per stress run             |               1,328.5 |                         38.4 |
| Fast CRDT subscriber alongside delayed subscriber |                  2.94 |                         2.73 |
| Peak stress RSS, MiB                              |                 630.9 |                        431.2 |

The delayed-reader workload includes a fixed 500 ms delay, and the CRDT workload
includes a 250 ms delayed subscriber. The Loro document contains 1 MiB of repeated
text, but Loro's own encoding reduces the update to about 8.6 KiB; this does not
measure a 1 MiB wire broadcast. Disconnect-during-result is exercised in the same
script; deterministic tests cover overflow and recipient isolation.

| Real browser workload                       | Base #927, compressed | Direct ASGI, compression off |
| ------------------------------------------- | --------------------: | ---------------------------: |
| Warm query                                  |                  2.31 |                         1.76 |
| Eight overlapping queries                   |                 14.16 |                        10.93 |
| 44 MB Arrow result                          |               1,711.8 |                        174.1 |
| 8 MB Arrow upload (warm pandas/import path) |                 908.5 |                         13.1 |
| Three 44 MB results, delayed consumption    |               4,817.6 |                        708.4 |
| Cancellation during those results           |               1,427.1 |                         0.69 |
| Maximum health latency per run              |               1,443.4 |                         9.43 |

Browser upload first iterations were 3,501 ms / 301 ms; warm uploads dominate
the three-run medians. A preliminary 44 MB upload exposed the old outer server's
16 MiB input limit (close 1009), so the paired workload uses 8 MB, as the original
Python baseline did. The new 128 MiB driver input limit is explicit. This browser
harness measures native WebSocket delivery, not React/Arrow decoding or rendering.
No measured final workload exceeds its recorded regression threshold.

### Functional, lifecycle, and release evidence

- 277 consolidated Python tests pass, including retained protocol/concurrency
  tests, credential rejection/expiry/revocation, framed upload, per-caller cancel,
  optional CRDT persistence, alternate app composition, bounded queues and
  handshake admission, failed save/checkpoint, repeated cancellation and startup
  cancellation and cancellation during close. Ruff lint and formatting pass.
- CLI UI build: 41 workspace tasks successful. Query WebSocket, sync and canvas
  sync example builds: 30 tasks successful. Existing Node script tests pass.
- A real Claude Code session discovered the six direct MCP tools, ran
  `SELECT 42`, authored a document and read it back. The bundled browser UI
  showed the document and `MCP READY`. This exercised the installed Claude host,
  not a simulated host. No global host configuration was changed.
- A real stdio client discovered eleven connector tools, started two disposable
  managed workspaces, exited, and restarted the connector. Both runtimes stayed
  alive and each had exactly one TCP listener. Both actual browser tabs reached
  `MCP READY`. A document created in A was absent from B. Closing A returned a
  browser flush acknowledgement; B still answered a query. Reopening A with a
  new instance binding restored the document in the browser.
- Final wheel and sdist contain runtime, UI, guidance, contract, license and
  version metadata. Isolated verification installs the wheel, rebuilds a wheel
  from the sdist outside this checkout, and exercises authenticated SQL plus
  checkpoint/reopen. A third isolated environment starts with both old wheels,
  uninstalls both before installing the new wheel, and passes the same checks.
  Old console aliases and distribution metadata are absent after migration.
- The actual `sqlrooms server --db-path ... --port ... --no-config` subprocess
  accepted an authenticated write, stopped with SIGTERM, and reopened with the
  expected persisted row.
- The supported `pnpm cli:publish:dry --target sqlrooms` release workflow passes.
  Publication was not performed. The base PR head was rechecked before opening
  the stacked PR. The existing empty `python/sqlrooms-server` pnpm lock importer
  is inert: pnpm no longer discovers that workspace; its lockfile regeneration
  preserves the empty record. The Python uv lock has the actual package removal.

Actual Codex-host authoring, Windows, slow remote networks, and full application
rendering benchmarks were not run. Protocol/adapter tests do not establish those
host/platform claims. Write/external-read browser approval policy was preserved
and covered by the existing tests; the live host flow used a safe constant query.

### Reproduction

Build workspace/UI assets first, install the Python development dependencies,
then run from the repository root:

```sh
python/.venv/bin/python python/sqlrooms/scripts/benchmark_runtime.py
python/.venv/bin/python python/sqlrooms/scripts/benchmark_stress.py
python/.venv/bin/python python/sqlrooms/scripts/benchmark_browser.py
# Open the last script's temporary loopback launch link in a real browser.
# It prints RESULT JSON after completion; stop the disposable server with Ctrl-C.
```

For the baseline, use a separate checkout/environment at the base commit and run
these same scripts with that interpreter. Preserve its default outer Uvicorn and
socketify compression. To reproduce the diagnostic ASGI compressed run, set
`ws_per_message_deflate=True` locally in `UVICORN_OPTIONS`; restore False afterward.
Browser result JSON contains no launch tickets or reusable credentials.
