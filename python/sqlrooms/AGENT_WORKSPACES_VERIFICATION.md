# Agent-managed workspaces verification

Implementation baseline: auth PR #926, commit
`d43f9e3df2e63fa130145dcd8a025b38d3718906`. Local verification was performed on
macOS with Python 3.12 and Claude Code 2.1.274. This records the tested scope; it
is not a claim that the complete product acceptance matrix has passed.

## Automated checks

- Python CLI and server: 238 tests passed. The regression suites cover the catalog, 200-entry bounded
  listing, failed probes, canonical paths, missing projects, live rediscovery,
  explicit targets, auth scopes, retained outcomes, cancellation before dispatch,
  caller isolation, close/command admission races, startup reservations, actual
  listener collisions, managed MCP stop/start, and setup ownership.
- CLI UI: 39 Jest suites, 202 tests; 24 additional Node tests passed.
- Shared MCP package: 2 suites, 14 tests passed. Canonical tool metadata is compared
  with the generated Python artifact, including a non-default metadata namespace.
- Workspace package build, CLI UI build/typecheck/lint, knip, Python Ruff checks,
  formatting, and generated-contract drift checks passed.
- Built CLI and companion server wheels/sdists contain the static contract, connector modules, bundled
  UI, and canonical native guidance. An installed wheel was loaded outside the
  checkout with a minimal PATH and a fresh catalog; stdio discovery returned all
  11 tools with no server running and no stdout protocol contamination. Dependency
  loading used the existing virtual environment; this was not a fresh-machine test.

## Live runtime and browser checks

A disposable managed DuckDB project under a temporary SQLROOMS_HOME was created
through the manager. The stable connector discovered commands, created a document,
and read it. A manual browser edit was saved; authenticated graceful close and
reopen retained the same workspaceId, allocated a fresh instanceId, and restored
the document and manual edit. An old instanceId was rejected as stale. The Recent
Workspaces UI displayed the saved path and live status; the persistence label
changed from unsaved to saved after editing.

A connector `SELECT 42 AS answer` displayed a per-request browser approval prompt.
After Allow once, the result contained the expected row. A later managed reopen
selected a different available HTTP port, and discovery returned that actual port. The final runtime reached browser readiness
on its first load and restored the document and manual edit.

One early reopened page restored the document but timed out connecting the DuckDB
WebSocket backend. Direct authenticated backend/proxy handshakes succeeded; a
subsequent browser reload recovered readiness. That failed attempt is retained in
this evidence rather than counted as a clean first-attempt acceptance pass.

## Client setup and remaining acceptance

Claude Code install, repeat setup/update, and uninstall succeeded using temporary
client configuration and the real native plugin CLI. The generated native plugin
contains guidance only; the global MCP entry owns the stable stdio transport.
Unrelated configuration, customized entries, and user-owned plugin sources are
covered by regression tests. No optional software or user's normal client settings
were changed.

Claude Desktop was not installed on the implementation host. Its native skill
upload, GUI-launched minimal environment, and complete multi-turn model scenario
remain unverified. A real Claude Code read-only model check was attempted after
explicit approval
with a $1 cap and no model override. It failed before tool use: OAuth session
expired and could not be refreshed (reported cost $0). Raw output remains local.
Full document/chart/map and dashboard round trips, two live browser workspaces, mounted-filesystem performance
on a real stalled volume, and the complete shutdown/restart acceptance matrix also
remain to be run. The tests include simulated stalled probes and actual MCP SDK
explicit-cancellation versus stream-EOF behavior, but these do not replace those
client acceptance runs. Cross-profile saved-state changes are rejected until
preservation is verified. Save As remains intentionally out of scope.
