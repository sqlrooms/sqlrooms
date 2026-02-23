# @sqlrooms/room-store

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

function Dashboard() {
  const value = useRoomStore((state) => state.counter.value);
  const increment = useRoomStore((state) => state.counter.increment);

  return <button onClick={increment}>Count: {value}</button>;
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

Inside components, `useRoomStoreApi()` gives you the raw store API:

```tsx
import {useRoomStoreApi} from '@sqlrooms/room-store';

function ResetButton() {
  const store = useRoomStoreApi();
  return (
    <button
      onClick={() => {
        // Example: imperative read from store
        const current = store.getState().room.initialized;
        console.log('initialized', current);
      }}
    >
      Inspect store
    </button>
  );
}
```
