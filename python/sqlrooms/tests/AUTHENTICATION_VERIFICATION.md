# Local authentication verification

Validated on macOS on 2026-09-18, stacked on PR #925 at `cb2d4a3de`.

- Workspace package build and production UI build passed. Python sdist/wheel build
  and bundled UI/plugin/auth-helper verification passed.
- Both Python suites passed: 191 tests, including direct socket auth, same-IP
  separation, binary rejection, connection-close safety, settings integrity,
  sentinel credential disclosure, ticket races/replay, scopes, private files,
  upstream failure/timeout, and active-socket renewal/expiry.
- Repository tests passed (34 tasks). CLI UI: 198 tests / 39 suites / 3 snapshots,
  plus 22 Node/supervisor tests. Type checking passed (56 tasks); unused-code and
  circular-dependency checks passed. Existing dependency/bundle-size and
  websockets-deprecation warnings remain.
- Real HTTP, direct DuckDB, proxy and browser-bridge listeners used an in-memory
  database. Native and page-authenticated SQL succeeded; binary Arrow upload
  succeeded. Renewal kept existing sockets and the bridge page identity across the
  original expiry. Without further renewal, direct and proxied SQL sockets and the
  bridge expired; expired renewal was denied.
- The built UI, using a disposable local database in external mode, showed recovery
  instructions at a bare URL. A single-use ticket opened the initialized workspace
  with the fragment removed and MCP READY. Manual document creation survived reload,
  and the bridge reconnected with session-storage authorization.
- Authenticated deterministic HTTP MCP discovered the live browser tools. `SELECT
42` prompted for browser approval and succeeded only after Allow once. Repeating
  it prompted again; Deny returned `permission_denied`.
- Claude Code 2.1.274 connected to this local MCP endpoint using the private-file
  headers helper, in a temporary isolated Claude configuration. This verifies native
  authentication, not model behavior. No model/provider call was made. Python
  launcher tests verify inherited TTY/model settings and owned-child cleanup.
- An independent security review found preflight, startup cleanup, connector-error
  redaction, standalone Origin compatibility, and socket-lifetime issues during
  implementation. These were fixed and covered by regression checks. Final review
  reported no blocking findings.

Tests use disposable keys and database state. No provider credential or launch
link is included in this record. Windows ACLs, cloud deployment, managed lifecycle,
Save As cutover, and actual-agent multi-turn behavior remain outside the verified
local milestone. Session-storage failure/restart/copy and scope rejection use
regression tests; a separate real-browser duplicate-tab scenario was not run.
