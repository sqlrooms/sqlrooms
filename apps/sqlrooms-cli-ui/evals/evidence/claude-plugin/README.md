# Claude plugin and interactive launcher — 2026-09-17

This change is stacked on open PR [#924](https://github.com/sqlrooms/sqlrooms/pull/924),
initially at `bdd326e6fda776ae963af1605bd861605a958818`, restacked before delivery
onto `61855993937305685e74e5ca1086055c1e8bd375`. Its branch/workspace was not changed.

## Design

The plugin is built from canonical `skills/sqlrooms` plus a native manifest and
an environment-based MCP connection template. Generated files are included and
checked in the Python wheel, never maintained as a second source. The existing
external suite has a small Claude argument/output adapter and keeps the Codex
path/CI, scenarios, fixtures, checks, shared runtime and process supervisor.

`--claude` starts the existing browser runtime in external mode and waits for its
authenticated bridge before spawning the terminal session. The browser is the
sole workspace. Claude uses its existing auth/model configuration. External
browser composition omits SQLRooms AI slices/toolkits/autosave and passes dormant
saved AI configurations through existing persistence. Manual editing, command
validation and per-query browser approvals remain in place.

## Local evidence (not uploaded or committed)

Directory: `artifacts/claude-plugin-2026-09-17/` in the implementation worktree.
The raw Claude streams, independent evidence envelopes, manifests, supervisor
result, MCP browser request results and build/test logs are retained there.
Historical headless evidence from #924 has not been copied or uploaded.

- `claude-01/`: real Claude Code **2.1.260**, native plugin **0.1.0**, canonical
  skill **v4**, both scenario versions **2**, `document-charts-maps@1`.
  The stream reports plugin/skill discovery and a connected MCP server. Both
  scenarios **error**: `Failed to authenticate: OAuth session expired and could
not be refreshed`. No authored state, observed guidance reads or tool calls;
  zero provider usage. Supervisor exit 1, no forced termination, no cleanup
  errors. This is not a passing evaluation. The original envelope's primary
  failure kind was `guidance` because that check ran first; the error list and
  raw output also record authentication. Classification now prioritizes process
  failure and excludes synthetic messages from observed model identity. No
  post-fix real rerun was made without an authentication change.
- Initial automatic approval review rejected the real run over provider/payload
  authorization. The user explicitly approved the synthetic fixture, prompts,
  guidance and tool results going to Claude's configured provider, then the
  single `claude-01` attempt above was run. No alternate model API was used.
- `browser/`: disposable two-row `analytics.events` database, production Python
  MCP bridge, built browser UI then Vite UI, `--no-config --execution-mode
external --profile document-charts-maps`. Initialized browser store inspection
  returned no `ai`, `aiSettings` or `artifactAi` keys. Manual document creation
  succeeded and real MCP discovered it. MCP chart/map creation and in-place
  chart revision became visible in the browser.
- The first browser chart used the old canonical `bar` example: state creation
  succeeded, rendering reported invalid configuration. Updated canonical skill
  **v5** to the existing renderer's `count-plot` aggregate schema and block
  `caption`. The corrected chart rendered category totals 20 and 12; the map
  rendered its basemap. A deterministic test now parses the guide's JSON example
  with the production chart schema. Behavioral fixtures/checks are unchanged,
  including the legacy state-only chart in the mutation fixture. No map pixel or
  geographic accuracy claim is made.
- Manual caption filling initially did not enter the component's click-to-edit
  mode. Both unchanged MCP reads were retained. After clicking the field, typing
  and pressing Enter, `manual-edit-observed-03.json` reports
  `Manually revised chart` through real MCP. This demonstrates browser/MCP state
  sharing, not Claude observing the edit.
- `query-approval-01.json` records a browser-approved query returning count 2.
  Two intended Deny interactions missed the active dialog and recorded allow
  outcomes; they are retained as `query-denied.json` and `query-denied-02.json`,
  not counted as denial evidence. Immediate DOM button interaction in
  `query-denied-03.json` returned `permission_denied`. Disconnecting the page
  returned retryable `room_not_ready`; reopening restored the MCP connection and
  the document. No mutation replay or new persistence guarantee is claimed.

## Verification

- Workspace packages built (50 tasks); CLI TypeScript and production UI build passed.
- Before restacking: CLI 192 tests / 38 suites / 3 snapshots; 16 Node/supervisor
  tests passed. After restacking: CLI 193 tests / 38 suites / 3 snapshots and
  22 Node/supervisor tests passed. The final pre-push hook passed unused-code,
  type checking (56 tasks), circular-dependency and repository tests (34 tasks).
  Some unchanged package tests reported worker-teardown warnings; no test failed.
- Python: 123 tests passed, including readiness, missing prerequisites/options,
  inherited authentication/model environment, terminal wiring, cancellation before
  launch, owned-child cleanup, HTTP failure/cancellation cleanup and stopped MCP
  listener detection.
- Python source distribution and wheel built; wheel verification checks all
  plugin guidance files, manifest/config and browser assets. Native
  `claude plugin validate` passed.
- Independent review prompted narrower pre-approved guidance reads and immediate
  failure when an owned MCP listener stops. Those fixes are included.

All initial failures remain in local logs: sandbox-blocked package build,
TypeScript `findLast` target mismatch, two new Python tests using flags after
the positional database (corrected to the existing CLI parser convention), a
focused Jest command missing the repository's required ESM runtime flags, and
two initial lifecycle tests missing required server constructor arguments.
An additional interactive startup smoke test was rejected before execution by
automatic approval review because its separate demo fixture was outside the
explicitly approved provider payload. It was not retried or counted as a pass.

## Packaging review follow-up — 2026-09-18

PR #925 identified that Turbo restores only the UI `dist/**` output, so a cache
hit skipped plugin generation. Generation now runs in the Python packaging step
after the cached UI build and before `uv build`. Removed both generated UI and
plugin directories after seeding the cache, then ran the Python package build:
all 41 Turbo tasks were cache hits, the plugin was regenerated, and wheel
verification passed. Every bundled plugin file also matched its canonical
source byte-for-byte. Local logs are in `review-2026-09-18/` under the evidence
directory above. No model calls were needed for this packaging verification.

## Outstanding acceptance

Claude authentication remains unavailable. The two real scenarios and a real
multi-turn browser-backed Claude session (create/revise document/chart/map,
observe a manual edit) remain **unverified**. Run `claude auth login`, then declare
a fresh-fixture attempt. Browser tests above used a deterministic MCP client;
they are not a substitute for that demonstration. Windows terminal/process
behavior and arbitrary Claude-spawned descendant cleanup are not verified.
Existing embedded deterministic tests pass; no new live embedded-model comparison
was attempted. No existing evidence was uploaded.

## Follow-up: create missing databases

Removed the extra existing-file restriction after user feedback. `--claude`
now uses normal CLI database startup: open an existing file, create a missing
one, or use `:memory:`. This does not add data import operations. Fifteen focused
launcher tests passed, including missing-file and in-memory CLI routing, and a
disposable smoke test confirmed the production database initializer creates a
missing file. Neither check invokes Claude or sends data to a model provider.
