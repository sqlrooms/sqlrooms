# sqlrooms CLI

Launch a local SQLRooms DuckDB project for adding data, authoring documents, and building Mosaic charts and dashboards.

## Quick start

```bash
uvx sqlrooms ./sqlrooms.db
```

This CLI requires `sqlrooms-server>=0.1.3` for its shared authentication boundary.
Release the updated server package before publishing this CLI; source installations
must install both updated packages together.

What happens:

- Starts the DuckDB websocket backend (from `sqlrooms-server`) on a free local port.
- Serves the SQLRooms document UI on `http://localhost:3000`, or the next free port, and opens your browser (disable with `--no-open-browser`).
- Drag-and-drop CSV, TSV, JSON, Parquet, and DuckDB files to load them into DuckDB; files are uploaded to a local `sqlrooms_uploads` folder and referenced by path.
- UI state is stored in the SQLRooms meta namespace (default `__sqlrooms`) of the selected DuckDB file.

## Map basemaps

Maps use [OpenFreeMap](https://openfreemap.org/) vector tiles with **Positron**
for light mode and **Dark** for dark mode. No API key or registration is required.

New maps keep the light/dark style matching the app theme at creation, including
after theme changes and workspace reloads. Change the saved style through
**Map settings → Basemap**. Existing custom map styles are preserved.

## CLI flags

- `DB_PATH` (positional): DuckDB project file to load/create (e.g. `sqlrooms ./my.db`). Required unless `--db-path` is provided.
- `--version`: Print the installed `sqlrooms` CLI version and exit.
- `--db-path`: DuckDB database to use as a flag alternative. Pass a filepath to persist, or `:memory:` for an explicit temporary in-memory session.
- `--host` / `--port`: HTTP host/port for the UI. The default bind address is `127.0.0.1`. If `--port` is omitted, `3000` or the next free port is chosen automatically.
- `--ws-port`: WebSocket port for DuckDB queries. If omitted, a free port is chosen automatically.
- `--profile`: Select a complete production capability profile: `default`, `experimental`, or `document-charts-maps`.
- `--experimental`: Compatibility alias for `--profile experimental`.
- `--experimental-sync`: Enable experimental sync (CRDT) over WebSocket (Loro). Requires the `experimental` profile.
- `--ai-devtools`: Enable the AI session devtools button in the UI, including production-built UI bundles. Can also be set with `SQLROOMS_AI_DEVTOOLS=1`.
- `--debug`: Enable verbose debug logging, including HTTP access logs and DuckDB query timing.
- `--meta-db`: Optional path to a dedicated DuckDB file for SQLRooms meta tables (UI state + CRDT snapshots). If omitted, meta tables are stored in the main DB.
- `--meta-namespace` (default `__sqlrooms`): Namespace for SQLRooms meta tables. If `--meta-db` is provided, used as ATTACH alias; otherwise used as a schema in the main DB.
- `--no-open-browser`: Skip automatically opening the browser tab.
- `--ui`: Optional path to a custom UI bundle directory (a Vite `dist/`). If omitted, uses the bundled default UI.
- `--no-ui`: Start only the HTTP API server and DuckDB websocket backend; do not serve the bundled/static UI.
- `--mcp`: Start a loopback-only MCP HTTP server backed by the live browser room.
- `--mcp-port`: Select the loopback MCP port (defaults to 42100 or the next free port).
- `--config`: Path to a SQLRooms TOML config file. Defaults to `~/.config/sqlrooms/config.toml` (`%APPDATA%\sqlrooms\config.toml` on Windows).
- `--no-config`: Disable config file loading.

Read-only artifact, document-block, and dashboard-panel image tools are always
available in the CLI UI. Using their image results requires a vision-capable
model and a provider that supports image tool results.

`--host 0.0.0.0` is an advanced local-network mode. Only use it on trusted
networks; it exposes the SQLRooms UI/API bind address beyond your loopback
interface. The DuckDB websocket backend still enforces local-only connections
unless you explicitly use external proxy settings.

The MCP listener uses the official stateless Streamable HTTP transport. The
browser must remain open and initialized because the live room owns the tool
catalog and execution state. Every MCP SQL query requires an allow-once dialog
in that browser. This approval and the one-statement `SELECT` check are not a
SQL sandbox; only approve SQL from a client and request you trust.

There is intentionally no `sqlrooms add`, `sqlrooms import`, or
`sqlrooms doctor` command in the first public CLI. Drag-and-drop import is the
supported first-launch path, and the release smoke checklist below covers the
doctor-style checks for now.

## Data persistence

Tables created in the selected DuckDB file (or attached meta DB if `--meta-db` is provided):

- `__sqlrooms.ui_state` (one row: `key='default'`)
- `__sqlrooms.sync_rooms` (only used when `--experimental --experimental-sync` is enabled)

Uploads go to `/api/upload`. Runtime config for the UI is exposed at `/api/config` / `/config.json`.

## Manual smoke test

Use this to prove the first-launch path:

```bash
uvx sqlrooms \
  --no-open-browser \
  ./smoke.duckdb
```

Then open the printed UI URL and verify:

- The app starts without a database connection error.
- Dragging a small CSV file into the data panel creates a table.
- The uploaded CSV lands next to `smoke.duckdb` under `sqlrooms_uploads/`.
- The data sidebar shows `main.cars` and does not show SQLRooms internal metadata.
- A document is created or selected automatically and contains a `cars` data-table explorer block.
- Users can create document and dashboard artifacts from the `New` menu without enabling `--experimental`.
- Map, notebook, canvas, app, HTML app, pivot, and SQL query surfaces stay hidden unless `--experimental` is provided.
- Restarting the same command with `./smoke.duckdb` restores the imported table and persisted workspace state.

## Config file

`sqlrooms` reads the app capability profile, AI provider settings, and connector
settings from a TOML config file.
AI settings changed in the CLI UI are saved back to this file automatically
when config loading is enabled and the config file is writable:

- macOS / Linux: `~/.config/sqlrooms/config.toml`
- Windows: `%APPDATA%\sqlrooms\config.toml`

Override with `--config <path>`, or disable with `--no-config`.

Example config file:

```toml
[app]
profile = "default"

[ai]
default_provider = "openai"
default_model = "gpt-5"

[[ai.providers]]
id = "openai"
base_url = "https://api.openai.com/v1"
api_key_env = "OPENAI_API_KEY"
models = ["gpt-5", "gpt-4.1"]

[[ai.providers]]
id = "anthropic"
base_url = "https://api.anthropic.com"
api_key_env = "ANTHROPIC_API_KEY"
models = ["claude-4-sonnet"]

[[ai.custom_models]]
model_name = "local-qwen"
base_url = "http://localhost:11434/v1"
api_key = "local-key"

[ai.model_parameters]
max_steps = 12
additional_instruction = "Prefer short answers."

[[db.connectors]]
id = "postgres-local"
engine = "postgres"
title = "Postgres Local"
host = "localhost"
port = "5432"
database = "postgres"
user = "postgres"
password = "postgres"

[[db.connectors]]
id = "snowflake-prod"
engine = "snowflake"
title = "Snowflake Prod"
account = "your-account"
user = "your-user"
password = "your-password"
warehouse = "your-warehouse"
database = "your-database"
schema = "your-schema"
role = "your-role"
authenticator = "externalbrowser"

[[db.connectors]]
id = "snowflake-dev"
engine = "snowflake"
title = "Snowflake Dev"
account = "your-dev-account"
user = "your-dev-user"
warehouse = "your-dev-warehouse"
```

## Server-only mode (no UI)

If you only want the DuckDB websocket server (no HTTP UI server), install/run `sqlrooms-server`:

```bash
uvx sqlrooms-server --db-path ./sqlrooms.db --port 4000
```

`sqlrooms-server` is also available as an alias console script.

## Backend connectors (DbSlice bridge)

Use these modes to run remote queries through backend connectors and materialize
results into core DuckDB for downstream notebook cells.

Install optional connector dependencies first:

```bash
uv tool install "sqlrooms[connectors]"
# or install just one connector:
uv tool install "sqlrooms[postgres]"
uv tool install "sqlrooms[snowflake]"
```

### Postgres

```bash
uvx sqlrooms \
  ./sqlrooms.db \
  --ws-port 4000 \
  --port 3000
```

### Snowflake

```bash
uvx sqlrooms \
  ./sqlrooms.db \
  --ws-port 4000 \
  --port 3000
```

What this enables:

- `sqlrooms` exposes connector bridge endpoints under `/api/db/*`.
- Runtime connector metadata is exposed via `/api/config`, so frontend `DbSlice` auto-registers available backend connections.
- Notebook SQL cells can select Postgres/Snowflake connectors from the connector dropdown.
- Arrow payloads are materialized into DuckDB and can be queried downstream in the same session.

Notes:

- Configure connectors in `sqlrooms.toml` using `[[db.connectors]]` entries.
- Connector libraries are optional extras (`postgres`, `snowflake`, or `connectors`).

## Interactive Claude Code workspace

```sh
# Claude must already be installed and authenticated (claude auth login).
# Options precede the positional database path, following the CLI's parser.
sqlrooms --claude --profile document-charts-maps ./my-project.duckdb
```

`--claude` enables MCP and external execution mode, opens the browser, waits up
to 90 seconds for its authenticated workspace bridge, then runs a normal
interactive Claude terminal session with inherited stdin/stdout. DuckDB opens an
existing database or creates a missing file, just as in normal CLI startup;
`:memory:` is also supported for a temporary workspace. A terminal is required.
`--no-open-browser` is supported if you
open the temporary single-use link printed on the interactive terminal; `--no-ui` is incompatible. No SQLRooms AI
configuration is needed (`--no-config` is optional).

Claude retains its own authentication and model preferences. The launcher loads
the bundled native plugin and session-only MCP configuration; it does not edit
Claude's global configuration or select an evaluation model. Use
`/sqlrooms:sqlrooms` to load the document/chart/map workflow. Only this session's
SQLRooms MCP server is attached. The child receives a private credential-file path;
a scoped header helper reads it to authenticate MCP. Tokens never appear in command
arguments or shared agent configuration. See [local authentication](AUTHENTICATION.md)
for browser launch tickets, native clients, expiry, and platform support.

The browser owns the workspace. Keep it open; manually edited content is visible
through MCP. Verified reads of workspace tables run without a prompt. External or unverified
SELECTs and database-writing commands require per-request browser approval.
Use `db.import-file` to materialize local CSV/Parquet/JSON files and
`db.create-table-from-query` for derived tables; both preserve existing tables
unless replacement is explicit. The CLI does not expose `room.add-url-data-source`.
See [data import and approvals](AGENT_WORKSPACES.md#importing-data).
Commands retain their existing validation. Disconnects fail pending operations;
the launcher reports disconnect/reconnect without replaying edits. On Claude
exit or cancellation, the launcher stops the HTTP/MCP listeners and reaps its
Claude child. It does not close browser windows or terminate unrelated sessions.
The DuckDB backend thread shares the launcher process lifetime, as in ordinary
CLI launches. Forced termination of arbitrary Claude-spawned descendants is not
claimed; Claude owns its native tool/subagent lifecycle.

For a browser managed by another client, use
`sqlrooms --execution-mode external --mcp ./existing.duckdb`. Execution mode is
independent of `--profile`. External mode composes no SQLRooms AI, AI-settings,
or artifact/chat slice. Existing saved conversations and settings pass through
workspace persistence unchanged until embedded mode is used again. This retains
the existing persistence mechanism; it is not a new durability guarantee.

`pnpm --filter sqlrooms-python build:ui` prepares both the UI bundle and the plugin
from the canonical CLI skill. Plugin generation runs after the cached UI build,
so this step also supports CI and deployment paths that invoke `uv build` directly.
`pnpm --filter sqlrooms-python build` prepares these assets, then packages and
verifies them in the wheel. No marketplace installation or publication is needed.
See the [verification record](../../apps/sqlrooms-cli-ui/evals/evidence/claude-plugin/README.md)
for tested behavior and outstanding real-Claude authentication requirements.

All CLI listeners require authentication, including localhost callers. Public base
URLs show a bootstrap recovery screen. See [local authentication](AUTHENTICATION.md)
for the private native credential file and development proxy configuration.

## Agent-managed workspaces

Run `sqlrooms agent setup --client claude-desktop` or `--client claude-code` to
preview one-time integration. The stable `sqlrooms agent connect` MCP adapter can
list saved projects, create named persistent workspaces, reuse live browsers, and
reopen by saved workspace ID. `sqlrooms agent status` reports redacted diagnostics.
See [agent-managed workspaces](AGENT_WORKSPACES.md) for setup, profiles, explicit
instance routing, recovery, lifecycle, and current verification limitations.
