# @sqlrooms/db-settings

> **Experimental:** This package's API and behavior may change between releases.

State and UI components for editing SQLRooms database connections and reporting
connector-driver availability.

This package complements `@sqlrooms/db`: the settings slice owns editable
configuration, while `syncConnectionsToDb()` copies available connections into
the database execution registry.

## Store setup

Compose the settings slice with a room store that already includes
`DbSliceState` (usually through `createRoomShellSlice()`):

```ts
import {
  createDbSettingsSlice,
  syncConnectionsToDb,
} from '@sqlrooms/db-settings';
import {createRoomShellSlice, createRoomStore} from '@sqlrooms/room-shell';

const {roomStore} = createRoomStore((set, get, store) => ({
  ...createRoomShellSlice({})(set, get, store),
  ...createDbSettingsSlice({
    config: {
      connections: [],
      diagnostics: [],
      supportedEngines: ['postgres'],
    },
  })(set, get, store),
}));

syncConnectionsToDb(roomStore);

const unsubscribe = roomStore.subscribe((state, previousState) => {
  const config = state.dbSettings.config;
  const previousConfig = previousState.dbSettings.config;
  if (
    config.connections !== previousConfig.connections ||
    config.diagnostics !== previousConfig.diagnostics
  ) {
    syncConnectionsToDb(roomStore);
  }
});

// Call unsubscribe() when the store is disposed.
```

Keep the subscription while the settings UI is active so edits immediately
update the execution registry. Connections whose matching diagnostic has
`available: false` are not registered for execution.

Connection `config` may contain credentials, so the example intentionally does
not add `DbSettingsSliceConfig` to `persistSliceConfigs()`. The schema is
available for validation, but hosts should keep credentials in server-managed
configuration or use an explicitly redacted persistence shape.

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

Use `DbConnectionsList`, `DbConnectionForm`, or
`ConnectorDriversDiagnostics` directly for lower-level composition.
