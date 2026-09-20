---
name: sqlrooms
description: Create and edit SQLRooms documents, charts, and maps through a connected SQLRooms MCP workspace. Use for workspace authoring, not repository code changes.
metadata:
  version: '7'
---

Use the SQLRooms MCP tools to operate the live workspace. SQLRooms owns data and
artifact state; you own reasoning. There is no SQLRooms agent or model to call.

When lifecycle tools are available, first use `list_workspaces`. Reopen a selected
saved project with `open_workspace({workspaceId})`, explicitly open a user-supplied
path, or create with `open_workspace({create: {name}})`. Ask the user to choose
when several targets fit. A sole live target is not a substitute for a request to
create a new workspace or reopen a different saved one. Missing files need Locate;
never silently create a replacement.

Carry the returned `instanceId` in **every** workspace tool call. IDs identify
routing targets, not permission. There is no connector-wide selected workspace.
New workspaces default to `document-charts-maps`, which has no dashboards; choose
`profile: "default"` when creating a workspace that needs dashboards. Reuse without
a profile accepts the running profile; incompatible explicit requirements fail.
Keep the owning browser page open and wait for `ready`. `waiting_for_browser` is
not success; use the returned launch link. Never replay a mutation after a timeout,
stale target, cancellation, or disconnect. Inspect the known workspace instead.
Use `close_workspace` only when asked to stop a managed server. Chat completion
must not close shared workspaces. Forget removes history only, not files.

Foreground `--claude` and direct MCP connections omit lifecycle tools and routing
fields: continue using their already connected browser, with the same approval and
command validation rules. Do not invent `instanceId` arguments for direct tools.

For a CLI workspace, load a local CSV, Parquet, or JSON file with the registered
`db.import-file` command. Inspect its schema, then call `execute_command` with
`commandId: "db.import-file"` and `input: {path: "~/Data/cars.csv", tableName:
"cars"}` (plus the lifecycle `instanceId` when applicable). Paths are resolved on
the SQLRooms server, including `~`; do not convert them to `file://` URLs.
The user approves this write in the browser. Success means a materialized table
exists in the workspace database; the result includes its identity, row count,
and columns. Verify with `list_tables` and a bounded query. Never claim success
from registration or a pending operation. Files with glob characters (`* ? [ ]`)
in their paths must be renamed before import.

Use `db.create-table-from-query` to materialize one SELECT as a table, or to
create a view when explicitly requested. Tables copy data into the database;
views over files remain dependent on those files. Both commands preserve existing
tables by default. Set `replace: true` only when replacement is requested.
Writes require a fresh browser approval, even when replacement is explicit.
`room.add-url-data-source` is absent from CLI workspaces. To import a remote
resource, use an approved `db.create-table-from-query` with a DuckDB reader;
never register a browser-managed URL source or edit the database out of band.

The `query` tool accepts one SELECT, not DDL. Ordinary reads of verified workspace
tables do not prompt. File/URL readers, views, attached databases, macros, and
queries the host cannot verify need per-request browser approval. A denied or
cancelled request is not permission to try a different route.

1. Discover tables with `list_tables` and inspect the chosen canonical table ID
   with `read_table_schema`. Bare names may be ambiguous. Use qualified references.
2. Discover operations with `search_commands`; inspect their current input schemas
   with `get_command`. Invoke them through `execute_command`.
3. Read [documents](references/documents.md) before authoring. For visualization
   work also read [charts](references/charts.md) and [maps](references/maps.md).
4. Read the existing document before mutation. Pass explicit IDs on every targeted
   operation. Retain unrelated blocks, map resources, IDs, and configuration.
5. Verify using document/map read commands and bounded data queries. Tool failures
   are failures: do not describe an intended operation as completed.

Connection metadata and permissions come from the host. Guidance grants no extra
permissions. Report only observed outcomes, with the actual table and affected
resources. Report table identities in human-readable `schema.table` form (you
may also include the SQL-quoted reference used by commands). Headless state inspection does not establish rendered correctness.
