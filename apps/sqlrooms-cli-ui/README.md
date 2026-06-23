# SQLRooms CLI UI

This package is the **Vite/React UI** that powers the Python `sqlrooms` CLI (`python/sqlrooms`).

In development it runs as a separate dev server (default `http://localhost:3100`) and **proxies API calls** to the Python server.

In production (published `sqlrooms` wheel), the UI is served as **static assets** bundled into the Python package at:

- `python/sqlrooms/sqlrooms/web/static/`

## Local CLI smoke test

For local pre-publish testing, run the workspace package directly rather than
assuming `sqlrooms` is installed globally:

```bash
cd /Users/ilya/Workspace/sqlrooms

pnpm --dir python/sqlrooms build

uv run --project python/sqlrooms sqlrooms \
  --no-open-browser \
  /tmp/sqlrooms-smoke.duckdb
```

Open the UI URL printed in the terminal. It should be
`http://127.0.0.1:3000` or the next free port.

The bare CLI command works only after installing the CLI somewhere on your
`PATH`:

```bash
uv tool install /Users/ilya/Workspace/sqlrooms/python/sqlrooms
sqlrooms --no-open-browser /tmp/sqlrooms-smoke.duckdb
```

For release smoke testing, verify both local execution paths:

```bash
uv run --project python/sqlrooms sqlrooms --no-open-browser /tmp/sqlrooms-smoke.duckdb
uv tool install --reinstall /Users/ilya/Workspace/sqlrooms/python/sqlrooms
sqlrooms --no-open-browser /tmp/sqlrooms-smoke.duckdb
```

In the UI, drag in:

```text
/Users/ilya/Workspace/sqlrooms/python/sqlrooms/tests/fixtures/cars.csv
```

Verify `cars` appears, create a worksheet/Mosaic chart/dashboard, stop the
server, restart the same command, and confirm the state comes back.

## Python CLI release workflow

The Python CLI release is split into an intentional version step and a publish
step. Publishing never bumps versions automatically.

Before versioning or publishing, test a production build locally:

```bash
pnpm --dir python/sqlrooms build

# Source/workspace check. This should reflect python/sqlrooms/package.json.
uv run --project python/sqlrooms sqlrooms \
  --version

uv run --project python/sqlrooms sqlrooms \
  --no-open-browser \
  /tmp/sqlrooms-smoke.duckdb
```

For the closest local install check, install the freshly built wheel from
`python/dist` into a `uv tool` environment. Use the exact wheel for the current
`python/sqlrooms/package.json` version so older files in `python/dist` are not
selected accidentally:

```bash
SQLROOMS_VERSION=$(node -p "require('./python/sqlrooms/package.json').version")
uv tool install --reinstall "python/dist/sqlrooms-${SQLROOMS_VERSION}-py3-none-any.whl"
sqlrooms --version
sqlrooms --no-open-browser /tmp/sqlrooms-smoke.duckdb
```

Open the printed UI URL, drag in the CSV fixture listed above, create a
worksheet/chart/dashboard, then restart against the same `/tmp/sqlrooms-smoke.duckdb` and
confirm the imported data and workspace state come back.

1. Choose the package target:
   - `sqlrooms` for the CLI package and bundled UI.
   - `sqlrooms-server` for the DuckDB websocket server package.
   - `all` when both packages should be released in dependency order.
2. Version the selected package or packages explicitly:

   ```bash
   pnpm cli:version --target sqlrooms-server --bump patch
   pnpm cli:version --target sqlrooms --set 0.2.0
   pnpm cli:version --target all --bump minor
   ```

   Hatch reads package versions from each package's `package.json`. When
   `sqlrooms-server` is versioned, the workflow also updates the
   `sqlrooms-server>=...` dependency floor in `python/sqlrooms/pyproject.toml`.

3. Run the dry publish workflow for the intended target:

   ```bash
   pnpm cli:publish:dry --target sqlrooms
   ```

   The dry workflow runs validation and builds the selected package or packages,
   but it does not upload to PyPI.

4. Publish the same target:

   ```bash
   pnpm cli:publish --target sqlrooms
   ```

   Publishing runs validation, builds the package, then uploads the built
   distributions with Twine. Use `--target all` only when both packages are part
   of the release.

## Dev mode (UI + Python server together)

From the repo root:

```bash
pnpm dev cli
```

This starts:

- the Python API server on `http://127.0.0.1:4273` with `--experimental` and without serving static UI, or the next free port
- the Vite UI on `http://localhost:3100`, or the next free port, proxying `/api` and `/config.json` to the selected Python API port
- a per-session dev database named after the selected UI port, for example `sqlrooms-3100.db`

If you want fixed ports, pass them to the Python server:

```bash
pnpm dev cli -- --port 4274 --ws-port 4002
```

## Dev mode (separate terminals)

Terminal A (Python server):

```bash
cd python/sqlrooms
pnpm dev -- --no-ui
```

Terminal B (UI):

```bash
pnpm --filter sqlrooms-cli-app dev -- --host --port 3100
```

The Python package dev helper uses API port `4273` by default to match the
Vite proxy. If you pass a different Python API port, also set
`SQLROOMS_CLI_API_PROXY_TARGET` when starting Vite.

## Build the bundled UI (for the Python wheel)

From the repo root:

```bash
pnpm --filter sqlrooms-cli-app build
```

This builds the UI into `apps/sqlrooms-cli-ui/dist`.

To copy it into the Python package bundle directory (so the published `sqlrooms` wheel can serve it), run:

```bash
cd python/sqlrooms
pnpm build:ui
```

## Dashboard Layouts

Dashboard artifacts are created with either a `dock` or `grid` Mosaic dashboard
layout. Explicit dashboard creation commands and AI tools require `layoutType`
so the choice is made once at creation time; auto-created dashboards from chart
or Data Table Explorer flows use `grid`.

## Worksheet Artifacts

Worksheet artifacts are block-composed documents for active analytical work.
They can contain editable text, images, standalone Mosaic/vgplot chart blocks, and
direct stateful blocks such as dashboards, pivot tables, Data Table Explorers,
SQL queries, and Markdown documents.

Standalone chart blocks reuse the same Mosaic chart view and settings panel as
dashboard charts. Charts with the same `selectionGroupId` in one Worksheet share
a crossfilter selection; charts without a group are independent.
Agent-created blocks can persist an `intent` string describing the purpose they
were created to serve, which helps later edits distinguish durable intent from
raw model input.

Hosted dashboards are stored as direct stateful blocks keyed by their block
instance id. Each hosted dashboard keeps its own Mosaic dashboard state and
selection scope, so multiple dashboards in one Worksheet crossfilter
independently.

Hosted SQL queries reuse the `@sqlrooms/sql-editor` single-query block surface.
The same query block can also be opened as a top-level SQL Query artifact tab.

## HTML App Revision History

Generated `html-app` artifacts and worksheet HTML app blocks store source
revisions in `@sqlrooms/app-runtime` state. The CLI registers these room
commands for palette and AI surfaces:

- `html-app.restore-revision`
- `html-app.undo-revision`
- `html-app.redo-revision`

Commands accept an optional `appId`. If omitted, the CLI resolves only a clearly
selected top-level `html-app` artifact or a single known HTML app runtime.
Ambiguous worksheet cases fail with a clear message so the caller can ask the
user to select the target block. Chat undo/redo should execute these commands
instead of mutating app state through hidden paths or rewriting chat messages.

## AI Artifact Context

The assistant captures selected artifact context at run start. The first
selected item is the primary context artifact unless the run context carries an
explicit `primaryItemId`.

Direct AI tools can list and read context artifacts with
`list_context_artifacts` and `read_context_artifact`. Mutating tools should pass
an explicit `artifactId`; if omitted, dashboard chart tools only use an
unambiguous primary dashboard. Reference artifacts are not implicit mutation
targets. `set_primary_context_artifact` updates the current run and session
context when the assistant creates or switches to a new primary artifact.
