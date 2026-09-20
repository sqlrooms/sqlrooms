# Agent-managed local workspaces

Built on auth PR #926 at `6ffe278f1f275214ed2b4af58e6fda9e2ecc14ae`.

```sh
sqlrooms agent setup --client claude-desktop --dry-run
sqlrooms agent setup --client claude-desktop
sqlrooms agent setup --client claude-code
sqlrooms agent status
sqlrooms agent connect
```

Setup previews the exact client entry, guidance actions, and tool permission changes. `--yes` applies only
the explicitly selected client; it installs no optional runtime or other software.
`--uninstall` removes only an unchanged SQLRooms-managed entry and its managed Code
plugin and the permission entries it added. Customized entries fail with a conflict; unrelated configuration is kept.
A database literally named `agent` needs an explicit path: `sqlrooms ./agent`.

Desktop setup writes the local MCP Developer configuration with the selected
absolute Python interpreter and `-m sqlrooms agent connect`. Upload the generated
`~/.sqlrooms/sqlrooms-skill.zip` through Customize → Skills and enable it; a loose
`~/.claude/skills` copy is not Desktop integration. Native Desktop guidance loading
is an explicit client step, not something the installer can attest to. Current
[Desktop documentation](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop)
also offers MCPB extensions; this release does not install an extension or bridge.
See [custom skill installation](https://support.claude.com/en/articles/12512180-use-skills-in-claude).
No installed Desktop version was available for acceptance on the implementation host.

Code setup installs a native guidance-only plugin through a local managed
marketplace, alongside the stable global MCP entry. It refuses duplicate loose
or differently sourced SQLRooms guidance. The foreground `sqlrooms file.duckdb
--claude` (`--claude-code`) flow still uses its session-scoped HTTP connection and
plugin, with no model override. Setup does not launch Claude or a workspace.

## Claude Code tool permissions

Interactive Code setup offers **Trust SQLRooms tools** (recommended). It adds
explicit `mcp__sqlrooms__<tool>` allow entries for the currently shipped tools to
`~/.claude/settings.json`. No wildcard or global permission mode is installed.
The MCP connection remains in `~/.claude.json`; `CLAUDE_CONFIG_DIR` redirects
both files to the selected Claude configuration directory.

Trust allows workspace discovery, creation, opening, closing, relocation and
catalog forgetting, plus document edits and the exposed query/command tools.
SQLRooms continues to enforce browser approval for database writes and external
or unverified reads. Existing Claude ask/deny entries and organization policies
remain effective, so they may still cause prompts or block calls. This option
applies to Claude Code, not Claude Desktop.

```sh
# Preview exact additions and removals without changing files:
sqlrooms agent setup --client claude-code --dry-run
# Explicitly accept the recommended trust option:
sqlrooms agent setup --client claude-code --trust-tools --yes
# Keep the connection and guidance, but remove only setup-owned allow entries:
sqlrooms agent setup --client claude-code --no-trust-tools --yes
```

`--yes` uses the recommended trust option unless `--no-trust-tools` is supplied.
Setup preserves unrelated settings, user-owned allow entries, and existing
restrictions. Repeat setup does not duplicate or adopt pre-existing permissions.
An ownership record lets uninstall remove only the unchanged entries SQLRooms
added. Interrupted permission writes are recoverable; conflicting edits are
preserved and reported instead of guessed. Switching configuration directories
while grants are owned requires uninstalling setup in the previous directory first.
Rerun setup and restart Claude Code to update an existing installation.

## Data and identities

- `~/.sqlrooms/workspaces.json`: versioned recent catalog. Random workspace UUIDs
  survive ordinary restarts. Canonical paths and symlink aliases deduplicate;
  copies at different paths receive different identities. Missing files stay in
  history until explicitly forgotten. The catalog is never silently rebuilt from
  malformed JSON. Updates use a process-safe lock and atomic replacement.
- `~/.sqlrooms/workspaces/<name>-<suffix>/workspace.duckdb`: durable managed
  projects, with the existing adjacent `sqlrooms_uploads` convention.
- `~/.sqlrooms/runtime/<instanceId>.json`: owner-only runtime registrations and
  private credential references. Status and listing omit those references and
  credentials. Native credentials and browser bootstrap use the auth boundary.
- `~/.sqlrooms/logs`: per-project managed-process logs rotate at 1 MiB, with two
  backups. Managed children use the connector's interpreter, detached sessions,
  disconnected stdin, and no inherited MCP stdout/stderr pipes.

`SQLROOMS_HOME` overrides catalog/runtime storage. `SQLROOMS_WORKSPACES_DIR`
overrides only managed project storage. Existing TOML configuration locations
remain unchanged. One `sqlrooms` distribution owns the runtime. Managed startup
reserves one listener and publishes only after the shared ASGI lifespan is ready.
Control contract version 2 publishes MCP at the API origin’s `/mcp`; restart old
workspaces and regenerate managed client configuration after upgrading. Customized
client entries are preserved, never automatically rewritten. This implementation requires POSIX permissions and lifecycle
semantics; Windows support is not claimed.

## Static tool surface

The connector always advertises five lifecycle/catalog tools plus six shared
workspace tools, even with no running server. No tool-list refresh is necessary.

- `list_workspaces({status?, refresh?, offset?, limit?})` joins recent entries,
  bounded managed-folder discovery, and verified live instances. It returns
  availability, last-check timestamps, lifecycle, browser readiness, compatibility,
  and pagination. An unavailable mount cannot make repeated requests accumulate
  unlimited probe workers. Availability successes and failures have a 30s TTL.
- `open_workspace` accepts exactly one of `workspaceId`, `path`, or `create:
{name?}`. It returns both identities, actual profile/mode/AI availability, browser
  URL and readiness. A short-lived single-use `launchUrl` is returned only to the
  authorized opener when needed. Never put it in saved discovery/status.
- `close_workspace({instanceId})` stops only managed instances, after the owning
  browser drains operations and confirms persistence. Missing browser, busy work,
  failed flush, or incompatible control protocol leaves the server running.
- `locate_workspace({workspaceId,path,confirmed:true})` preserves a saved identity
  after explicit user confirmation. It rejects live entries and path conflicts;
  it cannot independently prove that the replacement is the same workspace.
- `forget_workspace({workspaceId})` changes history only. Files/processes survive;
  managed projects and live instances remain discoverable.
- `query`, `list_tables`, `read_table_schema`, `search_commands`, `get_command`, and
  `execute_command` all require `instanceId` at the connector. The canonical
  browser schemas and policies remain intact. Verified reads of workspace tables
  run without a prompt. External or unverified SELECTs and database-writing
  commands need a separate browser approval for each request. Commands use the
  live registry's validation and restrictions.

New create requests default to `document-charts-maps`, which excludes dashboards.
Use `default` when creating a dashboard workspace. A closed saved workspace uses
its remembered profile; pre-catalog explicit files use the CLI's `default`.
Reuse without an override accepts the actual live profile and execution mode.
An explicit mismatch fails; cross-profile saved-state transitions remain disabled
until preservation has been demonstrated. No operation changes a running
instance's profile or takes ownership of a manually launched server.

Manual launches are remembered too: without MCP they remain advisory/non-callable;
embedded + MCP and external + MCP are reusable after authentication and readiness.
External mode alone does not enable MCP. `:memory:` is explicitly temporary and
has no saved catalog entry. Managed servers survive connector exit. Closing the
owning browser makes tools unavailable, and a second live tab cannot steal its lease.

## Importing data

CLI workspaces own materialized tables in their DuckDB file. The web project's
`room.add-url-data-source` command is removed from the CLI registry on every
surface. Use `get_command` then `execute_command` with:

```json
{
  "commandId": "db.import-file",
  "input": {
    "path": "~/Data/Pivot/cars-auto-mpg.csv",
    "tableName": "cars_auto_mpg"
  }
}
```

Include `instanceId` for connector calls. The authenticated host resolves the
local path, expands `~`, validates a readable regular file, and infers CSV,
Parquet, or JSON (including JSONL/NDJSON); `format` can override inference.
Paths containing DuckDB glob characters (`* ? [ ]`) are rejected. The browser
asks for write approval before resolving or reading the file. The command waits
for table creation and schema refresh, then returns table identity, row count,
and columns. Future reads use the materialized table, not the source file.

`db.create-table-from-query` is also exposed: it accepts one SELECT and preserves
existing tables unless `replace: true` is explicit. Both commands default to
persistent tables. An explicit view or temporary table is supported only by
`db.create-table-from-query`; a file-backed view is not self-contained. Internal
SQLRooms destinations and direct internal reads are blocked. Database writes,
including table deletion, always need a per-request browser approval over MCP.
Other high-risk commands retain their normal restrictions.

The `query` tool stays SELECT-only. Authenticated constant expressions and
verified reads of physical workspace tables can run without prompting. AST
inspection avoids binding queries to classify them: file scans, URLs, views,
attached catalogs, unknown functions, and ambiguous references require approval.
Function metadata is checked to detect macros shadowing built-ins. The policy is
conservative: unresolved CTE aliases may also prompt. This is a convenience policy,
not a sandbox for arbitrary approved SQL.

## Cancellation and compatibility

Each forwarded request allocates a UUID operation ID, scoped to a verified
connector credential and the runtime binding. Explicit stdio cancellation sends
an authenticated control request which cancels the broker task and dismisses
approval. The MCP 2.x adapter separately recognizes stream EOF; response loss
never implies user cancellation and never triggers mutation replay. Runtime
operations have a 35s deadline and bounded, expiring status records.

The internal authenticated `/api/agent/operation` endpoint reports known outcomes;
a disconnected caller receives an uncertain outcome with target and operation IDs.
Cancellation cannot undo committed work or guarantee stopping a non-cancellable
command. Tool-contract and minimal control versions are independent; an old
runtime remains visible and can be gracefully closed when control is compatible.

The pure `cliMcpToolContract.ts` is consumed by browser handlers and generated into
`sqlrooms/mcp_tool_contract.json`. Regenerate with:

```sh
pnpm --filter sqlrooms-cli-app mcp:contract:generate
```

CI rejects artifact drift, including descriptions and annotations. The artifact
ships in wheels and source distributions, and browser metadata is checked before
forwarding a managed call. Save As, automatic deletion, cloud auth, cross-platform
process support, and multi-writer collaboration remain outside this change.
