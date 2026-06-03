Low-level state management primitives for SQLRooms, built on Zustand.

Use this package when you want to build custom room state from scratch.  
If you want DuckDB + layout + room shell out of the box, use `@sqlrooms/room-shell`.

## Installation

```bash
npm install @sqlrooms/room-store
```

## What this package provides

- `createRoomStore()` and `createRoomStoreCreator()`
- base lifecycle slice: `createBaseRoomSlice()`
- generic slice helper: `createSlice()`
- React context/hooks: `RoomStateProvider`, `useBaseRoomStore`, `useRoomStoreApi`
- persistence helpers: `persistSliceConfigs()`, `createPersistHelpers()`
- room-store persistence glue: `createRoomStorePersistence()`
- persistence controller: `createPersistenceController()`

## Quick start

```tsx
import {
  BaseRoomStoreState,
  createBaseRoomSlice,
  createRoomStore,
  createSlice,
  type StateCreator,
} from '@sqlrooms/room-store';

type CounterSliceState = {
  counter: {
    value: number;
    increment: () => void;
  };
};

function createCounterSlice(): StateCreator<CounterSliceState> {
  return createSlice<CounterSliceState>((set, get) => ({
    counter: {
      value: 0,
      increment: () =>
        set((state) => ({
          counter: {
            ...state.counter,
            value: get().counter.value + 1,
          },
        })),
    },
  }));
}

type RoomState = BaseRoomStoreState & CounterSliceState;

export const {roomStore, useRoomStore} = createRoomStore<RoomState>(
  (set, get, store) => ({
    ...createBaseRoomSlice()(set, get, store),
    ...createCounterSlice()(set, get, store),
  }),
);
```

## React integration

```tsx
import {RoomStateProvider} from '@sqlrooms/room-store';
import {roomStore} from './store';

export function App() {
  return (
    <RoomStateProvider roomStore={roomStore}>
      <Dashboard />
    </RoomStateProvider>
  );
}
```

```tsx
import {useRoomStore} from './store';
import {Button} from '@sqlrooms/ui';

function Dashboard() {
  const value = useRoomStore((state) => state.counter.value);
  const increment = useRoomStore((state) => state.counter.increment);

  return <Button onClick={increment}>Count: {value}</Button>;
}
```

## Imperative access

Use `roomStore.getState()` for non-reactive code (events, timers, async jobs).

```ts
import {roomStore} from './store';

export function incrementLater() {
  setTimeout(() => {
    roomStore.getState().counter.increment();
  }, 500);
}
```

## Persistence Controller

Use `createPersistenceController()` when persistence policy should be explicit
instead of hidden inside a storage adapter. The controller is storage-agnostic:
hosts provide `load()` and `save()` adapter functions, while SQLRooms handles
hydration state, dirty tracking, scheduled saves, final flush, in-flight save
coalescing, and observable save status.

`createPersistHelpers()` still only handles schema-based partialization and
rehydrate merging. Compose it with the controller when a Zustand room store needs
both schema-safe snapshots and explicit save policy.

For room stores, prefer `createRoomStorePersistence()` before hand-writing that
composition. It provides controller-backed Zustand persist storage, rehydrate
saved-snapshot marking, optional room-store subscription, and final flush helpers.

```ts
import {createRoomStorePersistence} from '@sqlrooms/room-store';

const persistence = createRoomStorePersistence({
  partialize: (state) => ({room: state.room.config}),
  autosaveDelayMs: 300,
  load: async () => loadProjectSnapshot(),
  save: async (snapshot, metadata) => {
    await saveProjectSnapshot(snapshot, metadata?.reason);
  },
});

await persistence.hydrate();
await persistence.flush('final-flush');
```

Inside components, `useRoomStoreApi()` gives you the raw store API:

```tsx
import {useRoomStoreApi} from '@sqlrooms/room-store';
import {Button} from '@sqlrooms/ui';

function ResetButton() {
  const store = useRoomStoreApi();
  return (
    <Button
      onClick={() => {
        // Example: imperative read from store
        const current = store.getState().room.initialized;
        console.log('initialized', current);
      }}
    >
      Inspect store
    </Button>
  );
}
```
