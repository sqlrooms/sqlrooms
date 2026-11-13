# @sqlrooms/db-settings

> **Experimental:** This package's API and behavior may change between releases.

State and UI components for editing SQLRooms database connections and reporting
connector-driver availability.

Connection definitions live only in `db.config.connections`. Settings components
read that registry and edit it through `db.connectors.registerConnection()` and
`removeConnection()`. This slice owns editor options, connection testing through
the host transport, and server persistence. No connection synchronization is needed.

## Store setup

Compose the settings slice with a room store that includes `DbSliceState`
(usually through `createRoomShellSlice()`), and initialize connections in `db`:

```ts
import {DbConnection} from '@sqlrooms/db';
import {createDbSettingsSlice} from '@sqlrooms/db-settings';
import {createRoomShellSlice, createRoomStore} from '@sqlrooms/room-shell';

const warehouse = DbConnection.parse({
  id: 'warehouse',
  engineId: 'postgres',
  title: 'Warehouse',
  runtimeSupport: 'server',
  requiresBridge: true,
  bridgeId: 'server',
});

const {roomStore} = createRoomStore((set, get, store) => ({
  ...createRoomShellSlice({
    createDbProps: {
      config: {connections: {[warehouse.id]: warehouse}},
      diagnostics: [],
    },
  })(set, get, store),
  ...createDbSettingsSlice({
    config: {supportedEngines: ['postgres']},
  })(set, get, store),
}));
```

Register the corresponding bridge or direct connector through `db.connectors`
when configuring execution. Driver diagnostics live at
`db.connectors.diagnostics` and can be updated with `setDiagnostics()`.
Connections marked unavailable remain editable and are saved, but `db` excludes
them from catalog operations and rejects query execution.

`dbSettings.hasUnsavedChanges()` compares the canonical definitions with the last
successful save, or the store's initial definitions before the first save. It
also detects changes made directly through `db`, without subscriptions. In React,
select the boolean result: `useStoreWithDbSettings(s => s.dbSettings.hasUnsavedChanges())`.
A save captures the current non-core definitions; edits made while it is in flight
remain unsaved. Failed saves retain the previous baseline. Core connections are
excluded from dirty tracking and server saves.

Connection `config` may contain credentials. Keep it out of browser persistence
and shared workspace state unless explicitly redacted. Hosts should keep
credentials in server-managed configuration. `DbSettingsSliceConfig` now contains
only editor options (`supportedEngines` and `engineConfigFields`).

## Migrating from duplicated settings state

- Move initial connections into `createDbSlice({config: {connections}})`
  (a record keyed by ID), or the shell's `createDbProps`.
- Move initial diagnostics to `createDbSlice({diagnostics})`; read them from
  `db.connectors.diagnostics` and update them with `db.connectors.setDiagnostics()`.
  Import `ConnectorDriverDiagnostic` from `@sqlrooms/db`.
- Replace `dbSettings.upsertConnection()` / `removeConnection()` with
  `db.connectors.registerConnection()` / `removeConnection()`.
- Call `dbSettings.hasUnsavedChanges()` instead of reading a stored boolean.
- Remove `syncConnectionsToDb()` calls and subscriptions; the export is removed.

## UI

`DbSettings` is a compound component so the host can place connections,
diagnostics, and save controls in its own dialog or sidebar:

```tsx
<Tabs defaultValue="connections">
  <TabsList>
    <TabsTrigger value="connections">Connections</TabsTrigger>
    <TabsTrigger value="drivers">
      <DbSettings.DriversTabLabel />
    </TabsTrigger>
  </TabsList>
  <TabsContent value="connections">
    <DbSettings.Connections />
    <DbSettings.SaveButton apiBaseUrl="/sqlrooms" />
  </TabsContent>
  <TabsContent value="drivers">
    <DbSettings.Diagnostics />
  </TabsContent>
</Tabs>
```

The built-in save and test actions expect these JSON endpoints:

- `PUT {apiBaseUrl}/api/db/settings`
- `POST {apiBaseUrl}/api/db/test-connection`

Hosts can pass a `fetch(url, init)` transport to `createDbSettingsSlice` to
authenticate both actions or resolve a proxy base path. It defaults to browser
`fetch`; credentials and transport policy remain owned by the host application.

Use `DbConnectionsList`, `DbConnectionForm`, or
`ConnectorDriversDiagnostics` directly for lower-level composition.
