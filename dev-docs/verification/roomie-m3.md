# Roomie M3 verification

Baseline: `d35d0575bc58828f5f119e65b973e12ca3521735`, draft PR #962,
`feat/roomie-node-workspace`. Rechecked #960/#959 open at `eed050a6`/`8eb7a853`;
base unchanged. Baseline CI green. Node 24.22.1, pnpm 11.1.2, macOS arm64.

## Capability inventory

| Area          | Existing Node/browser                                                                          | Existing Python                                         | M3 gap                                                                                           |
| ------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| SQL and Arrow | Native 2.0/nanoarrow, read-only SELECT/DESCRIBE, per-query cancellation, four concurrent reads | Arrow/JSON/exec, binary uploads, connection-local tasks | Verified histogram arithmetic, wider types, upload/session contract and limits                   |
| Documents     | Durable shared commands, revisions, receipts, recovery; browser chart viewer only              | Browser-owned editor and CRDT writes                    | Authenticated browser commands, local drafts, explicit conflicts; table/dashboard/HTML renderers |
| Mosaic        | Preaggregation disabled, catalog refresh on content event                                      | Existing coordinator and disposable cache               | Safe session cache, explicit external refresh, latency workload                                  |
| Persistence   | SQLite schema versions 1→2, Loro recovery                                                      | Legacy envelope and CRDT in DuckDB                      | Backed-up migration and compatibility tests                                                      |
| Portability   | No bundle API                                                                                  | Existing database-file workflow                         | Versioned bundle, consistent database snapshots, explicit history policy, stable-ID round trips  |

The M2 recognized-revenue fixture remains January 300.00 and February 450.00,
with one row per paid order and whole-order refund exclusion.

M3 evidence is recorded below; release scope remains local development, with M4 deferred.

## Cache, refresh, and load measurements

Run `pnpm --filter roomie-node exec node test/benchmark-m3.mjs`.
The temporary workspace contains 1,000,000 rows, 100 categories, 50 samples per
phase, and 1 KiB synthetic event payloads. An authenticated native Quack client
continuously aggregates that table during the loaded phase. Filtering includes
WebSocket round-trip, policy validation, SQL, and Arrow serialization. Command
timings include catalog preparation and SQLite FULL commits; event timings include
SQLite FULL commits. Machine: Apple M3 Pro, Node 24.22.1, DuckDB 2.0.

| Measurement (ms)        | Idle p50 / p95 | Analytical + Quack load p50 / p95 |
| ----------------------- | -------------- | --------------------------------- |
| Filter round-trip       | 25.17 / 27.54  | 27.33 / 30.71                     |
| Document command commit | 5.31 / 6.68    | 6.21 / 7.88                       |
| Run event commit        | 0.221 / 0.342  | 0.206 / 0.270                     |

The load phase completed 250 Quack queries. External insertion, explicit refresh,
cache drop/rebuild, bundle export/import, 1,000,001 recovered rows and document
revision 101 passed. This is a local workload, not a production SLO.

## Query, editing, and migration evidence

- 60 native tests and 65 shared Node/Python conformance tests pass. Exact signed
  and unsigned 64-bit values, scaled Decimal128, leap-day dates, timestamp
  nanoseconds, binary bytes, empty schemas, and histogram intervals are asserted.
- Arrow JS 17 does not decode month/day/nanosecond INTERVAL results correctly.
  Node rejects raw INTERVAL output explicitly; casting to VARCHAR is supported
  and checked against Python. Interval arithmetic for date bins is supported.
- CSV, JSON, Parquet, and framed binary Arrow imports round-trip through real
  native files. Native sessions isolate temporary caches, reject unrestricted
  writes, rebuild after disconnect, and cancel queued requests promptly.
- The authenticated browser and an agent target the same revision: exactly one
  commits; the other receives a conflict. Reconciled retry and restart preserve
  content, stable receipts, code blocks, blockquotes, nested/task lists and titles.
- Seven focused browser component tests cover simultaneous title/content changes,
  delayed committed delivery, uncertain-save remount/retry, deterministic failure
  repair, stale revisions and independent-tab drafts.
- Live browser: amount/date histograms and table render correctly; brushing
  amounts filters to January orders 1 and 2 (100 and 200). A revision-3 draft
  survived a competing revision-4 agent edit and host restart with an explicit
  conflict. A later browser title save commits and retains all analytical blocks.
- Offline migration tests preserve the original database bytes, migrate v1/v2
  envelopes, canonical content snapshots and the actual shared document mirror,
  refuse ambiguous/future sources, preserve IDs, and rebind qualified chart/table
  sources from the old filename catalog to data.main.
- Bundle round trips preserve exact content, revisions, stable artifact/block/
  result-reference IDs, user data and Unicode assets. History is excluded by
  default; both policies are tested. Corruption and existing destinations are
  refused. An admitted export completes during immediate shutdown.

## Final local acceptance

The actual synthetic browser workspace was exported with and without history and
imported into fresh directories. Both copies preserve exact content/revisions and
the uploaded data. The browser recovered the categorical table (January 300,
February 450), numeric/date histograms, dashboard chart and HTML. The original
recognized-revenue query still returns exactly 300.00 and 450.00 with the original
order-grain/whole-refund definition. Browser file-chooser automation was unavailable;
HTTP and binary uploads were exercised against the real server, and the resulting
tables were verified in the browser.

A real Quack writer was active during export: stopping Quack, checkpointing,
importing and reading a consistent table/content snapshot passed. The normal
benchmark also verifies explicit refresh and cache rebuild after external writes.

Independent review findings were resolved and rechecked: exact rich document
content, assets, revision conflicts, durable tab-isolated draft slots and recovery,
uncertain-save retry, monotonic HTTP/WebSocket snapshot ordering, upload startup/
acknowledgement recovery, bounded JSON/Arrow output, Unicode bundle paths,
accepted export/session drain, qualified legacy bindings, and read-only dashboard
source/layout controls. SQL review found and verified fixes for Unicode CTE alias
folding and uppercase macro shadowing; identifier comparisons follow DuckDB's
ASCII case rules. Each CTE definition retains all physical-source/function checks.

HTML restart acceptance found undefined optional fields becoming null in opaque
Loro values. New writes omit undefined properties; older HTML fields normalize only
when the shared schema permits omission and rejects null. Restart and bundle tests
cover source-bearing HTML revisions.

Final local suites: 60 native tests, 65 shared Node/Python conformance tests,
95 browser tests, 181 Mosaic tests, 33 MCP tests with the real parser, and
32 app-runtime tests. Affected builds, lint, Knip, formatting and circular checks
pass. The full workspace build still encounters the unchanged MapLibre
style-spec mismatch in packages/deck/src/protomapsStyles.ts:36.
PR checks and the current plan record CI results on the pushed head.
