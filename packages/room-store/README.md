# @sqlrooms/room-store

This package provides the core state management for SQLRooms using [Zustand](https://github.com/pmndrs/zustand). It is designed to be extensible, allowing you to build custom room experiences by creating and composing state "slices".

## Installation

```bash
npm install @sqlrooms/room-store
```

## Core Concepts

### RoomStore

The `RoomStore` is a Zustand store that holds the entire state of a room. It is created by calling `createRoomStore` with one or more slice creators.

### RoomState

The `RoomState` is the object that defines the shape of the store. It has two main properties:

- `config`: This holds the configuration of the room that is persisted. This is defined by the generic type `PC` (Persisted Config) that you pass when creating a room.
- `room`: This holds the client-side state of the room, such as task progress, and provides actions for interacting with the room.

### Slices

A slice is a piece of the room's state and its associated actions. You can create your own slices to add custom functionality to your room. The `createRoomSlice` function is a helper to create a base slice with the core room functionality.

## Basic Usage

Here's an example of how to create a simple room store:

```typescript
import {createRoomStore, createRoomSlice} from '@sqlrooms/room-store';

// 1. Define the shape of your persisted room configuration
interface MyRoomConfig {
  title: string;
  version: number;
}

// 2. Define the full state of your room, including your custom config
interface MyRoomState extends RoomState<MyRoomConfig> {
  // You can add other top-level state properties here
}

// 3. Create the room store
const {roomStore, useRoomStore} = createRoomStore<MyRoomConfig, MyRoomState>(
  createRoomSlice({
    config: {
      title: 'My First Room',
      version: 1,
    },
    room: {},
  }),
);

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
  const setRoomConfig = useRoomStore((state) => state.room.setRoomConfig);

  const handleTitleChange = (newTitle: string) => {
    setRoomConfig({...useRoomStore.getState().config, title: newTitle});
  };

  return <h1>{title}</h1>;
}
```
