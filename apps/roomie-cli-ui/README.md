# Roomie browser application

A fixed, document-focused composition of SQLRooms packages, bundled by the
`roomie` Python distribution. Its only top-level artifact is a Document. Each
document can contain chart, data-table explorer, dashboard and HTML app blocks,
plus ordinary editorial content. Arbitrary custom Mosaic specs are excluded;
rendered charts and tables use physical local data. HTML query requests pass the
host's local-read admission policy before reaching the shared query executor. Dashboard panels are limited to Mosaic charts
and table explorers. Backing state is document-owned and is not exposed as extra
artifacts. No assistant, provider configuration, profiles or CRDT slice is loaded.

The **External AI** status opens connection instructions, led by the interactive
`roomie agent setup` command, with Claude Code, Codex, and manual MCP/skill setup
details. The status describes browser bridge readiness, not client connectivity
or installed skills.

Run `pnpm dev roomie [database.duckdb]` from the repository root. It builds shared
packages, installs the paired Python stack, starts API port 4274 and Vite port
3200, waits for readiness, verifies the backend process and binding, and opens a
one-use authorized page link. `--no-open-browser` retains the interactive launch
link without opening a tab. These fixed development ports fail clearly on
conflicts. Use the packaged CLI for an automatically assigned port.

`src/capabilities.ts` is the fixed capability manifest; `src/model.ts` defines
the persisted schema. Commands
in `src/commands.ts` compose the package APIs used by both manual UI actions and
MCP. `src/store.ts` wires only needed slices and validates persisted data before
enabling writes to the version-2 content-only `__roomie.ui_state` envelope.
Legacy version-1 content is validated and migrated on save; its selection and
table preferences are discarded. Current/pinned documents and table settings
now live in browser IndexedDB, keyed by database path within the current origin.
Hydration loads content first and prunes stale preference references. Tabs retain
independent in-memory views; the last saved view wins on reopen. Save status and
retry cover both content and preferences. Clearing browser data resets these
preferences without deleting documents. Table filters are saved as Mosaic-generated
predicates, validated as ordinary local SELECT expressions before agent changes
or hydration. Restored filters appear as a saved baseline; Reset clears them
before choosing a replacement. Column selection, sorting and page size are
editable through Edit blocks → data-table settings.
Shared domain composition and content commands also power the separate
[Node workspace foundation](../roomie-node/README.md); its authenticated browser
transport now supports the M2 read-only document and harness chat viewer.
Use **Add data** in the sidebar to choose or drop a CSV, Parquet, JSON, or JSONL
file. Roomie fills an available table name from the filename and automatically
shows up to 100 rows using `@sqlrooms/data-table`. Edit the name if needed, then
confirm to import all rows. Previewing does not create a workspace table.
The **File**, **Web URL**, and **File path** tabs keep their inputs when switching;
switching clears the preview and cancels any pending inspection.
Choose **Web URL** for a public HTTP(S) file link, or **File path** for a path on
the machine running Roomie, then click **Preview data**. URL formats are inferred
from the path (ignoring query parameters); choose the format for extensionless
links. DuckDB reads URLs on the Roomie host, so browser CORS does not apply.
Remote data is read again when importing and may have changed since preview.
Local uploads and paths use `db.import-file`; URLs use
`db.create-table-from-query`. Existing tables are never replaced.
For quick imports, drop one or more files on **Drop files to add immediately**
in the sidebar. This skips preview, uses automatic available names, and reports
successes and errors. The schema tree refreshes after each import; expand it to
inspect columns or use a table's menu to view data and copy names or SQL.
Saved references to dropped or renamed tables open with an inline block error so
documents remain editable. Existing disallowed sources still fail validation,
including views and attached tables hidden from selectors.

`pnpm --filter roomie-cli-app test` runs schema, command-boundary and filter
persistence regressions. `pnpm roomie:build` builds the dependency graph, browser
bundle, tool contract, notices, wheel and sdist. See
[Python usage and release instructions](../../python/roomie/README.md) and
[verification evidence](../../python/roomie/VERIFICATION.md).

## Node viewer (M2)

See the [Node host startup instructions](../roomie-node/README.md#local-start-and-browser-sign-in).
`src/node/view.tsx` composes the shared sidebar, responsive resizable panels,
`ChatHistoryItem`, `HarnessRunChat` composer/message/tool controls, and read-only
`BlockDocumentEditor`. History uses host-provided prompt labels and live status;
tool receipt links select the corresponding document. Host approval navigation
and document selection stay in Roomie. Native diagnostics are collapsed separately.
There is no embedded model loop, document editing, or broader query support in
this viewer. Closing a tab leaves host work running; reopening replays durable history.

### Node host editing and rendering

The Node viewer uses shared document, Mosaic chart/table/dashboard and HTML
renderers. Edit document creates a local draft; Save publishes exact document
content and title through `block-document.set-content` with the base revision and
an idempotency key. A stale revision preserves the draft and shows committed
content. An uncertain network outcome locks the draft and offers Retry same save.
Agent and browser edits share the same host command and SQLite commit boundary.

Import file accepts CSV, JSON, Parquet or Arrow up to 32 MiB and creates a new
physical table and a document showing it. Refresh data refreshes the host catalog and reconnects the
disposable Mosaic cache after external Quack changes. Local filtering/sorting never
writes shared content. Raw INTERVAL results require an explicit VARCHAR cast.
See the [Node host README](../roomie-node/README.md) for limits and bundle APIs.
