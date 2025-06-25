---
title: Offline Use
---

# Offline Use with SQLRooms

SQLRooms can be integrated into a [Progressive Web App (PWA)](https://web.dev/progressive-web-apps/) capable of working offline:

![SQLRooms Query Workbench progressive web app](/media/offline/sqlrooms-query-pwa.png)

All computation happens on your device, whether in the browser or a desktop app, with no backend required. This enables privacy, speed, and user control, even when you're completely offline.

Here's how you can implement an offline-first experience with SQLRooms:

## 1. Persisting State in localStorage

SQLRooms uses [Zustand](https://docs.pmnd.rs/zustand/getting-started/introduction) for state management. You can persist your app's state in the browser's `localStorage` using the `persist` middleware. This ensures user settings, layouts, and other state survive reloads and work offline.

**Example:**

```ts
import {persist} from 'zustand/middleware';

const {roomStore, useRoomStore} = createRoomStore(
  persist(
    (set, get, store) => ({
      // ...slices and state
    }),
    {
      name: 'sql-editor-example-app-state-storage', // localStorage key
      partialize: (state) => ({
        config: RoomConfig.parse(state.config),
      }),
    },
  ),
);
```

See [`examples/query/src/store.ts`](https://github.com/sqlrooms/examples/blob/main/query/src/store.ts) for a full example.

## 2. Using OPFS for DuckDB Storage

SQLRooms leverages [DuckDB-Wasm](https://duckdb.org/docs/wasm/overview.html) for in-browser SQL analytics. To persist your database between sessions, use the `opfs://` path, which stores the DuckDB database in the browser's [Origin Private File System (OPFS)](https://web.dev/origin-private-file-system/).

**Example:**

```ts
import {createWasmDuckDbConnector, DuckDBAccessMode} from '@sqlrooms/duckdb';

const connector = createWasmDuckDbConnector({
  path: 'opfs://database.db',
  accessMode: DuckDBAccessMode.READ_WRITE,
});
```

This allows users to keep their data local, persistent, and private.

## 3. Enabling Offline Support with PWA

To make your app work offline and provide a native-like experience, enable PWA support using [`vite-plugin-pwa`](https://vite-pwa-org.netlify.app/).

**Example vite.config.ts:**

```ts
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'SQLRooms Query Workbench',
        short_name: 'SQLRooms',
        start_url: '.',
        display: 'standalone',
        background_color: '#ffffff',
        description: 'Query Workbench example for SQLRooms',
        icons: [
          {src: 'icon.png', sizes: '192x192', type: 'image/png'},
          {src: 'icon.png', sizes: '512x512', type: 'image/png'},
        ],
      },
    }),
  ],
});
```

See [`examples/query/vite.config.ts`](https://github.com/sqlrooms/examples/blob/main/query/vite.config.ts) for a real-world config.

## 4. Example: SQL Query Editor

The [SQL Query Editor example](https://sqlrooms.org/examples.html#sql-query-editor) demonstrates all of these offline techniques in a real app. It persists state, stores data in OPFS, and works offline as a PWA.

---

By combining these techniques, you can build analytics applications with SQLRooms that are fast, private, and fully offline—empowering your users to own their data and work anywhere, anytime.
