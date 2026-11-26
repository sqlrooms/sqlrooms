Main SQLRooms application shell and default Room slice composition.

`@sqlrooms/room-shell` bundles:

- base room lifecycle (`room-store`)
- DuckDB slice (`@sqlrooms/duckdb`)
- layout slice (`@sqlrooms/layout`)
- React shell UI (`RoomShell`, sidebar/layout/loading components)

Use this package as the default entry point for most SQLRooms apps.

## Installation

```bash
npm install @sqlrooms/room-shell @sqlrooms/duckdb @sqlrooms/ui
```

## Quick start

```tsx
import {
  createRoomShellSlice,
  createRoomStore,
  RoomShell,
  RoomShellSliceState,
} from '@sqlrooms/room-shell';
import {DatabaseIcon} from 'lucide-react';

function DataPanel() {
  return <div className="p-2">Data panel</div>;
}

function MainPanel() {
  return <div className="p-2">Main panel</div>;
}

type RoomState = RoomShellSliceState;

export const {roomStore, useRoomStore} = createRoomStore<RoomState>(
  (set, get, store) => ({
    ...createRoomShellSlice({
      config: {
        title: 'My SQLRooms App',
        dataSources: [
          {
            type: 'url',
            tableName: 'earthquakes',
            url: 'https://huggingface.co/datasets/sqlrooms/earthquakes/resolve/main/earthquakes.parquet',
          },
        ],
      },
      layout: {
        config: {
          type: 'split',
          direction: 'row',
          children: [{type: 'panel', id: 'data', defaultSize: '28%'}, 'main'],
        },
        panels: {
          data: {
            title: 'Data',
            icon: DatabaseIcon,
            component: DataPanel,
          },
          main: {
            title: 'Main',
            icon: () => null,
            component: MainPanel,
          },
        },
      },
    })(set, get, store),
  }),
);

export function App() {
  return (
    <RoomShell roomStore={roomStore} className="h-screen">
      <RoomShell.Sidebar />
      <RoomShell.LayoutComposer />
      <RoomShell.LoadingProgress />
      <RoomShell.CommandPalette />
    </RoomShell>
  );
}
```

## Common room actions

```tsx
import {useRoomStore} from './store';
import {Button} from '@sqlrooms/ui';

function RoomActions() {
  const setRoomTitle = useRoomStore((state) => state.room.setRoomTitle);
  const addDataSource = useRoomStore((state) => state.room.addDataSource);
  const removeDataSource = useRoomStore((state) => state.room.removeDataSource);
  const addRoomFile = useRoomStore((state) => state.room.addRoomFile);

  return (
    <div className="flex gap-2">
      <Button onClick={() => setRoomTitle('Updated title')}>Rename room</Button>
      <Button
        onClick={() =>
          void addDataSource({
            type: 'sql',
            tableName: 'top_quakes',
            sqlQuery:
              'SELECT * FROM earthquakes ORDER BY Magnitude DESC LIMIT 100',
          })
        }
      >
        Add SQL data source
      </Button>
      <Button onClick={() => void removeDataSource('top_quakes')}>
        Remove SQL data source
      </Button>
      <Button
        onClick={async () => {
          const file = new File(['id,name\n1,Alice'], 'people.csv', {
            type: 'text/csv',
          });
          await addRoomFile(file);
        }}
      >
        Add file
      </Button>
    </div>
  );
}
```

## Hiding internal tables

Apps sometimes keep tables that users should not pick from, such as a staging
table for a pending replacement. Pass table and catalog filters to the DuckDB
slice through `createDbProps.duckDb`:

```ts
import {
  createDefaultLoadTableSchemasFilter,
  defaultLoadSchemaCatalogFilter,
  type QualifiedTableName,
} from '@sqlrooms/duckdb';

const isStagingTable = (table: QualifiedTableName) =>
  table.table.startsWith('staging_');
const defaultTableFilter = createDefaultLoadTableSchemasFilter();

createRoomShellSlice({
  // ...
  createDbProps: {
    duckDb: {
      // Hides matching tables from `db.tables` and `db.loadTableSchemas()`.
      loadTableSchemasFilter: (table, metadata) =>
        defaultTableFilter(table, metadata) && !isStagingTable(table),
      // Hides them from `db.schemaTrees` (the data source panel).
      loadSchemaCatalogFilter: (entry, metadata) =>
        defaultLoadSchemaCatalogFilter(entry, metadata) &&
        !(entry.type === 'table' && isStagingTable(entry.table)),
    },
  },
})(set, get, store);
```

Filtered tables are hidden after the next schema refresh but stay queryable by
SQL. Without `createDbProps.duckDb` filters, the defaults hide `__sqlrooms*`
names and DuckDB's `temp` database. A custom filter **replaces** the default, so
build on `createDefaultLoadTableSchemasFilter()` and
`defaultLoadSchemaCatalogFilter` as above to keep that hiding. If you pass only
`loadTableSchemasFilter`, it also applies to table entries in the catalog, and
databases and schemas keep the default catalog filter. See
[`@sqlrooms/duckdb`](../duckdb/README.md#table-visibility-and-catalog-inspection)
for the filter callbacks.

## Persistence

Use `persistSliceConfigs` with schemas:

```tsx
import {
  BaseRoomConfig,
  LayoutConfig,
  createRoomStore,
  persistSliceConfigs,
} from '@sqlrooms/room-shell';

const persistence = {
  name: 'my-room-storage',
  sliceConfigSchemas: {
    room: BaseRoomConfig,
    layout: LayoutConfig,
  },
};

createRoomStore(
  persistSliceConfigs(persistence, (set, get, store) => ({
    // compose slices here
  })),
);
```

For host-owned storage such as DuckDB-backed project files, prefer
`createRoomStorePersistence` alongside these schema helpers. It is the default
room-store integration for explicit hydration, dirty tracking, save scheduling,
final flush, and save status without repeating Zustand subscription and
saved-snapshot wiring in every app.

Use `createPersistenceController` directly only for lower-level integrations that
need the same save policy outside a Zustand room store.

## Guarded command invocation

`@sqlrooms/room-shell` re-exports `invokeCommandWithPolicy()`,
`createCommandCliAdapter()`, and `createCommandMcpAdapter()` from
`@sqlrooms/room-store`. External and agent-facing integrations must use these
guarded APIs rather than invoking commands directly. They re-check command
availability and require explicit confirmation for high-risk or
confirmation-gated commands. See the
[room-store command guide](../room-store/README.md#guarded-command-invocation)
for usage and fail-closed semantics.

## Related packages

- `@sqlrooms/sql-editor`
- `@sqlrooms/ai`
- `@sqlrooms/mosaic`
- `@sqlrooms/vega`

## DuckDB workspace persistence

`createDuckDbPersistStorage<T>(connector, {namespace})` adapts a DuckDB connector
for `persistSliceConfigs`. The default metadata namespace is `__sqlrooms`; an
alternate application can supply its own namespace. The server must create that
namespace. Storage provides `controller`, `flush()` and `completeHydration(state)`.
Call `completeHydration` only after schema validation, merge and application
initialization succeed. Until then, writes are suppressed so an unsupported or
failed restore cannot overwrite saved metadata. Subscribe to the controller with
its listener API; `getState()` returns a copy and is not a React snapshot getter.
A host that replaces or closes the adapter must call `dispose()` to remove its
browser lifecycle handlers.
A managed close must flush and check `error`, `dirty` and `saving` before claiming
persistence succeeded.
The adapter requests a browser unload warning while changes are dirty or saving.
Flushing when the page becomes hidden is best effort; browser shutdown cannot
guarantee completion of asynchronous writes. Explicit close and reload flows must
await `flush()` and stay open if it rejects. Failed metadata table initialization
is retried on the next load, save, or removal.
