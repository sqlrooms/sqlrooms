# @sqlrooms/webcontainer

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
- `WebContainerSliceState` (TypeScript type)

## Quick usage

```ts
import {createRoomStore, persistSliceConfigs} from '@sqlrooms/room-store';
import {
  createWebContainerSlice,
  WebContainerSliceConfig,
  type WebContainerSliceState,
} from '@sqlrooms/webcontainer';

type RoomState = WebContainerSliceState;

export const {roomStore, useRoomStore} = createRoomStore<RoomState>(
  persistSliceConfigs(
    {
      name: 'my-room',
      sliceConfigSchemas: {
        webcontainer: WebContainerSliceConfig,
      },
    },
    (set, get, store) => ({
      ...createWebContainerSlice({
        config: {
          filesTree: {
            src: {
              directory: {
                'App.jsx': {file: {contents: "export default function App() { return 'hello'; }"}},
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
  ),
);
```

## Runtime notes

- The slice state key is `webcontainer`.
- Call `webcontainer.initialize()` once during app startup.
- `updateFileContent()` updates both open-file state and the in-memory `filesTree`.
- `saveAllOpenFiles()` writes dirty files to the WebContainer filesystem.

## Related

- Depends on `@webcontainer/api` for the underlying runtime.
- Designed to compose with other SQLRooms slices inside `createRoomStore()`.
