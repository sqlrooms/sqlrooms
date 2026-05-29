# SQLRooms CLI UI

This package is the **Vite/React UI** that powers the Python `sqlrooms` CLI (`python/sqlrooms-cli`).

In development it runs as a separate dev server (default `http://localhost:4174`) and **proxies API calls** to the Python server (default `http://localhost:4173`).

In production (published `sqlrooms` wheel), the UI is served as **static assets** bundled into the Python package at:

- `python/sqlrooms-cli/sqlrooms/web/static/`

## Dev mode (UI + Python server together)

From the repo root:

```bash
pnpm dev cli
```

This starts:

- the Python API server on `http://127.0.0.1:4173` without serving static UI
- the Vite UI on `http://localhost:4174` (proxying `/api` and `/config.json` to 4173)

If you hit `address already in use`, pass different ports to the Python server:

```bash
pnpm dev cli -- --port 4176 --ws-port 4002
```

Then also update the Vite proxy target in `vite.config.ts` (or run Vite with a different proxy setup).

## Dev mode (separate terminals)

Terminal A (Python server):

```bash
cd python/sqlrooms-cli
pnpm dev -- --no-ui
```

Terminal B (UI):

```bash
pnpm --filter sqlrooms-cli-app dev -- --host --port 4174
```

## Build the bundled UI (for the Python wheel)

From the repo root:

```bash
pnpm --filter sqlrooms-cli-app build
```

This builds the UI into `apps/sqlrooms-cli-ui/dist`.

To copy it into the Python package bundle directory (so the published `sqlrooms` wheel can serve it), run:

```bash
cd python/sqlrooms-cli
pnpm build:ui
```

## Dashboard Layouts

Dashboard artifacts are created with either a `dock` or `grid` Mosaic dashboard
layout. Explicit dashboard creation commands and AI tools require `layoutType`
so the choice is made once at creation time; auto-created dashboards from chart
or profiler flows use `grid`.

## Analysis Artifacts

Analysis artifacts are block-composed documents for narrative analytical work.
They can contain rich text, images, standalone Mosaic/vgplot chart blocks, and
direct stateful blocks such as dashboards, pivot tables, and Markdown
documents.

Standalone chart blocks reuse the same Mosaic chart view and settings panel as
dashboard charts. Charts with the same `selectionGroupId` in one Analysis share
a crossfilter selection; charts without a group are independent.

Hosted dashboards are stored as direct stateful blocks keyed by their block
instance id. Each hosted dashboard keeps its own Mosaic dashboard state and
selection scope, so multiple dashboards in one Analysis crossfilter
independently.

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
