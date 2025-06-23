# @sqlrooms/room-store

This package provides the core state management for SQLRooms using [Zustand](https://github.com/pmndrs/zustand). It is designed to be extensible, allowing you to build custom room experiences by creating and composing state "slices".

## Installation

```bash
npm install @sqlrooms/room-store @sqlrooms/room-config zod zustand
```

## Core Concepts

### RoomStore

The `RoomStore` is a Zustand store that holds the entire state of a room. It is created by calling `createRoomStore` with a function that composes one or more slice creators.

### RoomState

The `RoomState` is the object that defines the shape of the store. It has two main properties:

- `config`: This holds the configuration of the room that is persisted. This is defined by a `zod` schema, often extending the `BaseRoomConfig` from `@sqlrooms/room-config`.
- `room`: This holds the client-side state of the room, such as task progress, and provides actions for interacting with the room.

### Slices

A slice is a piece of the room's state and its associated actions. You can create your own slices to add custom functionality to your room. The framework provides `createRoomSlice` to create the base slice with core room functionality. You combine this with your own slices inside the `createRoomStore` composer function.

## Basic Usage

Here's an example of how to create a room store with a custom feature slice.

```typescript
import {
  createRoomStore,
  createRoomSlice,
  RoomState,
} from '@sqlrooms/room-store';
import {BaseRoomConfig} from '@sqlrooms/room-config';
import {z} from 'zod';
import {StateCreator} from 'zustand';

// 1. Define your persisted room configuration schema using Zod.
// This extends the base config with a custom property.
export const MyRoomConfig = BaseRoomConfig.extend({
  defaultChartType: z.enum(['bar', 'line', 'scatter']).default('bar'),
});
export type MyRoomConfig = z.infer<typeof MyRoomConfig>;

// 2. Define the state and actions for your custom feature slice.
export interface MyFeatureSlice {
  activeChartId: string | null;
  setActiveChartId: (id: string | null) => void;
}

// 3. Create your custom slice.
export const createMyFeatureSlice: StateCreator<MyFeatureSlice> = (set) => ({
  activeChartId: null,
  setActiveChartId: (id) => set({activeChartId: id}),
});

// 4. Define the full state of your room, combining the base RoomState
// with your custom slice's state.
export type MyRoomState = RoomState<MyRoomConfig> & MyFeatureSlice;

// 5. Create the room store by composing the base slice and your custom slice.
export const {roomStore, useRoomStore} = createRoomStore<
  MyRoomConfig,
  MyRoomState
>((set, get, store) => ({
  ...createRoomSlice<MyRoomConfig>({
    config: {
      // You can provide initial values for your config here
      title: 'My First Room',
      defaultChartType: 'line',
      // other properties from BaseRoomConfig will have defaults
    },
    room: {},
  })(set, get, store),

  // Add your custom slice to the store
  ...createMyFeatureSlice(set, get, store),
}));

export {roomStore, useRoomStore};
```

## Providing the Store

To make the store available to your React components, you need to use the `RoomStateProvider` component at the root of your application.

```tsx
import {RoomStateProvider} from '@sqlrooms/room-store';
import {roomStore} from './my-room-store';

function App() {
  return (
    <RoomStateProvider value={roomStore}>
      {/* Your room components go here */}
    </RoomStateProvider>
  );
}
```

## Accessing the Store in Components

You can use the `useRoomStore` hook returned by `createRoomStore` to access the room's state and actions from any component.

```tsx
import {useRoomStore} from './my-room-store';

function RoomTitle() {
  const title = useRoomStore((state) => state.config.title);
  const activeChartId = useRoomStore((state) => state.activeChartId);
  const setActiveChartId = useRoomStore((state) => state.setActiveChartId);

  return (
    <div>
      <h1>{title}</h1>
      <p>Active Chart: {activeChartId || 'None'}</p>
      <button onClick={() => setActiveChartId('chart-123')}>
        Activate Chart
      </button>
    </div>
  );
}
```
