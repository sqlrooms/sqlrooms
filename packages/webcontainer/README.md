# @sqlrooms/webcontainer

> **Experimental:** This package's API and behavior may change between releases.

WebContainer state slice and runtime helpers for SQLRooms stores.

This package provides a ready-to-use Zustand slice for managing:

- WebContainer boot lifecycle
- dependency installation and dev server startup
- file open/edit/save state
- in-memory file tree synchronization for AI/editor tooling
- HMR-safe browser caching of the active WebContainer instance

## What it exports

- `createWebContainerSlice()`
- `createDefaultWebContainerSliceConfig()`
- `WebContainerSliceConfig` (Zod schema)
- `WebContainerPersistConfig` (persistence-safe Zod schema)
- `WebContainerSliceState` (TypeScript type)

## Quick usage

```ts
import {
  createBaseRoomSlice,
  createRoomStore,
  type BaseRoomStoreState,
} from '@sqlrooms/room-store';
import {
  createWebContainerSlice,
  type WebContainerSliceState,
} from '@sqlrooms/webcontainer';

type RoomState = BaseRoomStoreState & WebContainerSliceState;

export const {roomStore, useRoomStore} = createRoomStore<RoomState>(
  (set, get, store) => ({
    ...createBaseRoomSlice()(set, get, store),
    ...createWebContainerSlice({
      config: {
        filesTree: {
          src: {
            directory: {
              'App.jsx': {
                file: {
                  contents: "export default function App() { return 'hello'; }",
                },
              },
            },
          },
          'package.json': {
            file: {
              contents: JSON.stringify(
                {
                  name: 'webcontainer-app',
                  private: true,
                  scripts: {dev: 'vite'},
                },
                null,
                2,
              ),
            },
          },
        },
        activeFilePath: '/src/App.jsx',
      },
    })(set, get, store),
  }),
);
```

## Runtime notes

- The slice state key is `webContainer`.
- Call `room.initialize()` once during app startup; it initializes the
  WebContainer slice through the room lifecycle.
- `updateFileContent()` updates both open-file state and the in-memory `filesTree`.
- `saveAllOpenFiles()` writes dirty files to the WebContainer filesystem.

The quick start intentionally leaves `webContainer` out of
`persistSliceConfigs()`. The live `filesTree` may include an installed
`node_modules` tree and become too large for browser storage. If a host needs to
persist lightweight editor state, use `WebContainerPersistConfig`, never
`WebContainerSliceConfig`, and provide a custom persistence merge that retains
the initial `filesTree` from the current slice configuration.

## Related

- Depends on `@webcontainer/api` for the underlying runtime.
- Designed to compose with other SQLRooms slices inside `createRoomStore()`.
