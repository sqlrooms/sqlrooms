# sqlrooms CLI

Launch a local SQLRooms DuckDB project for adding data, authoring worksheets, and building Mosaic charts and dashboards.

## Quick start

```bash
uvx sqlrooms ./sqlrooms.db
```

What happens:

- Starts the DuckDB websocket backend (from `sqlrooms-server`) on a free local port.
- Serves the SQLRooms worksheet UI on `http://localhost:3000`, or the next free port, and opens your browser (disable with `--no-open-browser`).
- Drag-and-drop CSV, TSV, JSON, Parquet, and DuckDB files to load them into DuckDB; files are uploaded to a local `sqlrooms_uploads` folder and referenced by path.
- UI state is stored in the SQLRooms meta namespace (default `__sqlrooms`) of the selected DuckDB file.

## CLI flags

- `DB_PATH` (positional): DuckDB project file to load/create (e.g. `sqlrooms ./my.db`). Required unless `--db-path` is provided.
- `--db-path`: DuckDB database to use as a flag alternative. Pass a filepath to persist, or `:memory:` for an explicit temporary in-memory session.
- `--host` / `--port`: HTTP host/port for the UI. The default bind address is `127.0.0.1`. If `--port` is omitted, `3000` or the next free port is chosen automatically.
- `--ws-port`: WebSocket port for DuckDB queries. If omitted, a free port is chosen automatically.
- `--experimental`: Enable experimental artifacts, blocks, commands, and agent tools.
- `--experimental-sync`: Enable experimental sync (CRDT) over WebSocket (Loro). Requires `--experimental`.
- `--ai-devtools`: Enable the AI session devtools button in the UI, including production-built UI bundles. Can also be set with `SQLROOMS_AI_DEVTOOLS=1`.
- `--debug`: Enable verbose debug logging, including HTTP access logs and DuckDB query timing.
- `--meta-db`: Optional path to a dedicated DuckDB file for SQLRooms meta tables (UI state + CRDT snapshots). If omitted, meta tables are stored in the main DB.
- `--meta-namespace` (default `__sqlrooms`): Namespace for SQLRooms meta tables. If `--meta-db` is provided, used as ATTACH alias; otherwise used as a schema in the main DB.
- `--no-open-browser`: Skip automatically opening the browser tab.
- `--ui`: Optional path to a custom UI bundle directory (a Vite `dist/`). If omitted, uses the bundled default UI.
- `--no-ui`: Start only the HTTP API server and DuckDB websocket backend; do not serve the bundled/static UI.
- `--config`: Path to a SQLRooms TOML config file. Defaults to `~/.config/sqlrooms/config.toml` (`%APPDATA%\sqlrooms\config.toml` on Windows).
- `--no-config`: Disable config file loading.

`--host 0.0.0.0` is an advanced local-network mode. Only use it on trusted
networks; it exposes the SQLRooms UI/API bind address beyond your loopback
interface. The DuckDB websocket backend still enforces local-only connections
unless you explicitly use external proxy settings.

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
- A worksheet is created or selected automatically and contains a `cars` data-table explorer block.
- Users can create worksheet and dashboard artifacts from the `New` menu without enabling `--experimental`.
- Map, notebook, canvas, app, HTML app, pivot, and SQL query surfaces stay hidden unless `--experimental` is provided.
- Restarting the same command with `./smoke.duckdb` restores the imported table and persisted workspace state.

## Release workflow

The Python CLI release is split into an intentional version step and a publish
step. Publishing never bumps versions automatically.

1. Choose the package target:
   - `sqlrooms` for the CLI package and bundled UI.
   - `sqlrooms-server` for the DuckDB websocket server package.
   - `all` when both packages should be released in dependency order.
2. Version the selected package or packages explicitly:

   ```bash
   pnpm cli:version -- --target sqlrooms-server --bump patch
   pnpm cli:version -- --target sqlrooms --set 0.2.0
   pnpm cli:version -- --target all --bump minor
   ```

   Hatch reads package versions from each package's `package.json`. When
   `sqlrooms-server` is versioned, the workflow also updates the
   `sqlrooms-server>=...` dependency floor in `python/sqlrooms/pyproject.toml`.

3. Run the dry publish workflow for the intended target:

   ```bash
   pnpm cli:publish:dry -- --target sqlrooms
   ```

   The dry workflow runs the same validation and build steps as publish, but it
   does not upload to PyPI.

4. Publish the same target:

   ```bash
   pnpm cli:publish -- --target sqlrooms
   ```

   Publishing runs validation, builds the package, then uploads the built
   distributions with Twine. Use `--target all` only when both packages are part
   of the release.

## Config file

`sqlrooms` reads AI provider and connector settings from a TOML config file.
AI settings changed in the CLI UI are saved back to this file automatically
when config loading is enabled and the config file is writable:

- macOS / Linux: `~/.config/sqlrooms/config.toml`
- Windows: `%APPDATA%\sqlrooms\config.toml`

Override with `--config <path>`, or disable with `--no-config`.

Example config file:

```toml
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
