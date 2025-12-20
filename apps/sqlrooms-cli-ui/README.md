# SQLRooms CLI UI

This package is the **Vite/React UI** that powers the Python `sqlrooms` CLI (`python/sqlrooms-cli`).

In development it runs as a separate dev server (default `http://localhost:4174`) and **proxies API calls** to the Python server (default `http://localhost:4173`).

In production (published `sqlrooms` wheel), the UI is served as **static assets** bundled into the Python package at:

- `python/sqlrooms-cli/sqlrooms/web/static/`

## Dev mode (UI + Python server together)

From `python/sqlrooms-cli`:

```bash
pnpm dev
```

This starts:

- the Python server on `http://127.0.0.1:4173`
- the Vite UI on `http://localhost:4174` (proxying `/api` and `/config.json` to 4173)

If you hit `address already in use`, pass different ports to the Python server:

```bash
pnpm dev:server -- --port 4176 --ws-port 4002
```

Then also update the Vite proxy target in `vite.config.ts` (or run Vite with a different proxy setup).

## Dev mode (separate terminals)

Terminal A (Python server):

```bash
cd python/sqlrooms-cli
pnpm dev:server
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
