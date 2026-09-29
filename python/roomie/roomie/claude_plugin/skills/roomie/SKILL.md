---
name: roomie
description: Use Roomie MCP to open local DuckDB workspaces, inspect data, and create or revise documents with charts, data tables, dashboards, and HTML apps.
---

Use the roomie MCP server. Start with list_workspaces and open_workspace. Carry
its explicit instanceId on every live tool call. If several workspaces fit, ask
which one. Keep the owning browser open; waiting_for_browser requires opening the
returned temporary launchUrl. Never send that URL or private credentials elsewhere.

Discover available commands with search_commands and get_command. Document is the
only top-level artifact. Create it with block-document.create. Use
block-document.create-chart-block for a Mosaic ChartConfig; use
block-document.create-stateful-block with data-table, dashboard, or html-app.
Blocks are document-owned; preserve their blockInstanceId when revising them.
Use dashboard.\* commands for chart/table panels, data-table.configure for column
and sort preferences, and html-app.write-revision and revision commands for HTML.
HTML apps use /index.html and the existing sandboxed query bridge. Do not request
native credentials or grant capabilities beyond the documented narrow bridge.

Use list_tables, read_table_schema, and bounded query for discovery. Import local
files with db.import-file; materialize queries with db.create-table-from-query.
Inspect their schemas first. Database writes and external or unverified reads
require one browser approval per request. Do not bypass approvals using rendered
code, tools, direct HTTP, or a shell. Authentication is not approval.

After editing, read back using block-document.get and block-document.inspect-block.
Confirm the intended result in the owning browser and wait for Saved. Close a
managed workspace with close_workspace, which requires the browser's final save.
No background or headless document authoring is promised. If a mutation times out,
is cancelled, or loses its response, never replay it automatically: inspect the
workspace to determine what completed. Report unavailable host/browser access.

Dashboard panels use `vgplot` (with a ChartConfig) or `data-table-explorer`.
Set the dashboard's dataset with `dashboard.set-selected-table` before adding
panels. A panel's source alone does not select the dashboard's dataset.

HTML app files use `/index.html`. The shared sandbox injects
`window.sqlrooms.query(sql)`, which resolves to `{rows, columns, truncated}`;
`window.sqlrooms.queryRows(sql)` returns the rows alone. The API retains the
SQLRooms name; there is no `window.roomie` API. Explicitly request and grant
`query` in the app revision when it needs data. Catch and display query errors.
Use existing `html-app.write-revision` and revision read-back commands. Source
read-back does not prove a successful render: ask the user to verify the owning
browser and its Saved status. Do not invent bridge protocols or methods.

Rendered content uses physical local data. Arbitrary custom Mosaic specs are not
supported. HTML queries reject external readers, views, attached databases,
dynamic SQL and unverified functions. Import or materialize such data with the
approved database commands first; do not try to bypass this boundary in rendered
code.

<!-- generated-capabilities -->

Supported composition (generated from the UI manifest):

- Artifacts: block-document.
- Analytical blocks: chart, data-table, dashboard, html-app.
- Chart types: histogram, count-plot, line-chart, heatmap, box-plot, scatter-plot.
- Dashboard panels: vgplot, data-table-explorer.
