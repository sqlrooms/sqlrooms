# sqlrooms CLI

Launch the SQLRooms AI example locally with a DuckDB websocket backend and persisted UI state inside the same DuckDB file.

## Quick start

```bash
# From the repo root
uvx sqlrooms \
  ./sqlrooms.db \
  --ws-port 4000 \
  --port 4173 \
  --llm-provider openai \
  --llm-model gpt-4o-mini \
  --api-key sk-...
```

What happens:

- Starts the DuckDB websocket backend (from `sqlrooms-server`) on `ws://localhost:4000`.
- Serves the AI example UI on `http://localhost:4173` and opens your browser (disable with `--no-open-browser`).
- Drag-and-drop CSV/Parquet/DuckDB files to load them into DuckDB; files are uploaded to a local `sqlrooms_uploads` folder and referenced by path.
- UI state is stored in the SQLRooms meta namespace (default `__sqlrooms`) of the selected DuckDB file.

## CLI flags

- `--db-path` (default `:memory:`): DuckDB file to load/create. The `__sqlrooms` schema is created automatically.
- `DB_PATH` (positional): Optional positional alternative to `--db-path` (e.g. `sqlrooms ./my.db`).
- `--host` / `--port`: HTTP host/port for the UI (default `127.0.0.1:4173`).
- `--ws-port`: WebSocket port for DuckDB queries. If omitted, a free port is chosen automatically.
- `--sync`: Enable optional sync (CRDT) over WebSocket (Loro).
- `--meta-db`: Optional path to a dedicated DuckDB file for SQLRooms meta tables (UI state + CRDT snapshots). If omitted, meta tables are stored in the main DB.
- `--meta-namespace` (default `__sqlrooms`): Namespace for SQLRooms meta tables. If `--meta-db` is provided, used as ATTACH alias; otherwise used as a schema in the main DB.
- `--llm-provider`, `--llm-model`, `--api-key`: Passed into the UI as defaults for the AI assistant (provider defaults to `openai`, model to `gpt-4o-mini`).
- `--no-open-browser`: Skip automatically opening the browser tab.
- `--ui`: Optional path to a custom UI bundle directory (a Vite `dist/`). If omitted, uses the bundled default UI.
- `--postgres-dsn`: Enables a Postgres backend connector bridge (also via `SQLROOMS_POSTGRES_DSN`).
- `--snowflake-account` + `--snowflake-user`: Enables a Snowflake backend connector bridge (supports env vars `SNOWFLAKE_*` for credentials/settings).
- `--postgres-connection-id` / `--snowflake-connection-id`: Connector ids exposed to `DbSlice` and notebook SQL cells.
- `--postgres-title` / `--snowflake-title`: Labels shown in the SQL cell connector picker.

## Data persistence

Tables created in the selected DuckDB file (or attached meta DB if `--meta-db` is provided):

- `__sqlrooms.ui_state` (one row: `key='default'`)
- `__sqlrooms.sync_rooms` (only used when `--sync` is enabled)

Uploads go to `/api/upload`. Runtime config for the UI is exposed at `/api/config` / `/config.json`.

## Server-only mode (no UI)

If you only want the DuckDB websocket server (no HTTP UI server), install/run `sqlrooms-server`:

```bash
uvx sqlrooms-server --db-path ./sqlrooms.db --port 4000
```

`sqlrooms-server` is also available as an alias console script.

## Backend connectors (DbSlice bridge)

Use these modes to run remote queries through backend connectors and materialize
results into core DuckDB for downstream notebook cells.

### Postgres

```bash
uvx sqlrooms \
  ./sqlrooms.db \
  --ws-port 4000 \
  --port 4173 \
  --postgres-dsn "postgresql://postgres:postgres@localhost:5432/postgres"
```

### Snowflake

```bash
uvx sqlrooms \
  ./sqlrooms.db \
  --ws-port 4000 \
  --port 4173 \
  --snowflake-account "<account>" \
  --snowflake-user "<user>" \
  --snowflake-password "<password>" \
  --snowflake-warehouse "<warehouse>" \
  --snowflake-database "<database>" \
  --snowflake-schema "<schema>"
```

What this enables:

- `sqlrooms-cli` exposes connector bridge endpoints under `/api/db/*`.
- Runtime connector metadata is exposed via `/api/config`, so frontend `DbSlice` auto-registers available backend connections.
- Notebook SQL cells can select Postgres/Snowflake connectors from the connector dropdown.
- Arrow payloads are materialized into DuckDB and can be queried downstream in the same session.

Notes:

- `--postgres-dsn` can also be provided via `SQLROOMS_POSTGRES_DSN`.
- Snowflake can be configured via `SNOWFLAKE_ACCOUNT`, `SNOWFLAKE_USER`, `SNOWFLAKE_PASSWORD`, `SNOWFLAKE_WAREHOUSE`, `SNOWFLAKE_DATABASE`, `SNOWFLAKE_SCHEMA`, `SNOWFLAKE_ROLE`, and `SNOWFLAKE_AUTHENTICATOR`.
- Requires Python connector libraries at runtime (`psycopg` for Postgres, `snowflake-connector-python` for Snowflake).

## Developer setup

Local dev loop for the CLI and UI:

1. Install deps and build the dedicated UI (from repo root):

```bash
pnpm install
pnpm --filter sqlrooms-cli-app build
# build outputs directly to python/sqlrooms-cli/sqlrooms/web/static
```

2. Dev the Python CLI (from repo root or package dir):

```bash
cd python/sqlrooms-cli
pnpm dev  # starts uv server and Vite dev UI together
```

3. Hot reload UI on its own (optional):

```bash
cd python/sqlrooms-cli
pnpm dev:ui -- --host --port 4174
```

Tips:

- Use `--no-open-browser` if you don’t want the static bundle auto-opened.
- Rebuild the UI (`pnpm --filter sqlrooms-cli-app build`) when you want the Python server to serve new static assets.
- `/api/config` reflects CLI flags (provider/model/api key, WS URL).
