# SQLRooms CRDT Sync Example (Vite)

Minimal React + Zustand example that mirrors state to a Loro CRDT via `@sqlrooms/crdt` and syncs against `sqlrooms-server` with CRDT enabled.

## Run the server (with CRDT)

```bash
cd python/sqlrooms-server
uv run sqlrooms-server --db-path main.db --crdt-db crdt.db --port 4000
```

## Run the client

```bash
cd examples/sync
pnpm install
pnpm dev
```

Open two tabs at http://localhost:4173 to see live sync. State persists locally via `localStorage` and on the server via `--crdt-db`.

Environment overrides (optional):

- `VITE_SYNC_WS_URL` (default `ws://localhost:4000`)
- `VITE_SYNC_ROOM_ID` (default `demo-room`)

# SQLRooms CRDT Sync Example

Minimal example that wires `@sqlrooms/crdt` into a vanilla Zustand store and syncs through the `sqlrooms-sync` WebSocket server.

## Run the sync server

```bash
cd python/sqlrooms-sync
uv run python -m pkg.server  # listens on ws://localhost:4800
```

## Run the example

```bash
cd examples/sync
pnpm install
pnpm build
pnpm dev
```

You should see console logs of the mirrored state. Start a second process to observe updates flowing through the server. State is persisted locally via `createLocalStorageDocStorage`.

