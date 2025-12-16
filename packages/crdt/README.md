# @sqlrooms/crdt

CRDT utilities for SQLRooms built on top of Loro Mirror. The package exposes `createCrdtSlice`, a Zustand slice helper that mirrors selected parts of your store into a Loro CRDT document, plus a small set of persistence and sync helpers.

## Installation

```bash
pnpm add @sqlrooms/crdt loro-crdt loro-mirror
```

## Quick start

```ts
import {schema} from 'loro-mirror';
import {createRoomStore, persistSliceConfigs} from '@sqlrooms/room-shell';
import {BaseRoomConfig, LayoutConfig} from '@sqlrooms/room-config';
import {
  createCrdtSlice,
  createLocalStorageDocStorage,
  createWebSocketSyncConnector,
} from '@sqlrooms/crdt';

const mirrorSchema = schema({
  room: schema.LoroMap({config: schema.Ignore()}), // mirror only the config portions
  layout: schema.LoroMap({config: schema.Ignore()}),
});

const {roomStore, useRoomStore} = createRoomStore(
  persistSliceConfigs(
    {
      name: 'sqlrooms-sync-demo',
      sliceConfigSchemas: {room: BaseRoomConfig, layout: LayoutConfig},
    },
    (set, get, store) => ({
      ...createCrdtSlice({
        schema: mirrorSchema,
        bindings: [
          {key: 'room', select: (s) => s.room?.config, apply: (value) => set({room: {...get().room, config: value}})},
          {key: 'layout', select: (s) => s.layout?.config, apply: (value) => set({layout: {...get().layout, config: value}})},
        ],
        storage: createLocalStorageDocStorage('sqlrooms-sync-demo'),
        sync: createWebSocketSyncConnector({
          url: 'ws://localhost:4800',
          roomId: 'demo-room',
          // If your server sends a snapshot on join (like sqlrooms-duckdb-server),
          // prefer updates-only to avoid re-sending full snapshots on reconnects.
          sendSnapshotOnConnect: false,
          // Still seed an empty server once after join (important if you load initial
          // state from local persistence without generating CRDT ops).
          sendSnapshotIfServerEmpty: true,
        }),
      })(set, get, store),
      // add your other slices here
    }),
  ),
);

// Call roomStore.getState().crdt.initialize() after creating the store to start sync
```

### Concepts

- **Bindings**: map each mirrored CRDT field to a piece of Zustand state. Provide `select` to choose the outbound data and optional `apply` to merge inbound CRDT updates. If `apply` is omitted, the binding writes to a top-level key.
- **Storage**: implement `CrdtDocStorage` to persist snapshots (localStorage helper included).
- **Sync**: plug a `CrdtSyncConnector` (websocket helper included) that forwards local updates and applies remote updates via `doc.import`.

See `examples/sync` for an end-to-end demonstration with the Python sync server.

### Testing & debugging

- Mirror emits `tags` metadata; we tag store-origin writes as `from-store` to avoid loops. Log `mirror.subscribe` in your app if you need deeper inspection.
- Use the `storage` hook to inject an in-memory or temp store in tests; pass a fake `sync` connector that captures `subscribeLocalUpdates` traffic for assertions.
- The websocket connector exposes `onStatus` for basic connection logging; attach console logs or telemetry there during development.

