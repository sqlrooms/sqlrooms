# @sqlrooms/db-settings

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
  DbSettingsSliceConfig,
  createDbSettingsSlice,
  syncConnectionsToDb,
} from '@sqlrooms/db-settings';
import {
  createRoomShellSlice,
  createRoomStore,
  persistSliceConfigs,
} from '@sqlrooms/room-shell';

const {roomStore} = createRoomStore(
  persistSliceConfigs(
    {
      name: 'my-workspace',
      sliceConfigSchemas: {
        dbSettings: DbSettingsSliceConfig,
      },
    },
    (set, get, store) => ({
      ...createRoomShellSlice(roomShellOptions)(set, get, store),
      ...createDbSettingsSlice({
        config: {
          connections: [],
          diagnostics: [],
          supportedEngines: ['postgres'],
        },
      })(set, get, store),
    }),
  ),
);

syncConnectionsToDb(roomStore);
```

Call `syncConnectionsToDb()` after initialization and after replacing settings
from an external source. Connections whose matching diagnostic has
`available: false` are not registered for execution.

Connection `config` may contain credentials. Do not persist secrets in browser
storage unless that is an explicit security decision for your application.

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
