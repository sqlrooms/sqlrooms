# @sqlrooms/room-shell

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
  LayoutTypes,
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
          type: LayoutTypes.enum.mosaic,
          nodes: {
            direction: 'row',
            first: 'data',
            second: 'main',
            splitPercentage: 28,
          },
        },
        panels: {
          data: {
            title: 'Data',
            icon: DatabaseIcon,
            component: DataPanel,
            placement: 'sidebar',
          },
          main: {
            title: 'Main',
            icon: () => null,
            component: MainPanel,
            placement: 'main',
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
    </RoomShell>
  );
}
```

## Common room actions

```tsx
import {useRoomStore} from './store';

function RoomActions() {
  const setRoomTitle = useRoomStore((state) => state.room.setRoomTitle);
  const addDataSource = useRoomStore((state) => state.room.addDataSource);
  const removeDataSource = useRoomStore((state) => state.room.removeDataSource);
  const addRoomFile = useRoomStore((state) => state.room.addRoomFile);

  return (
    <div className="flex gap-2">
      <button onClick={() => setRoomTitle('Updated title')}>Rename room</button>
      <button
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
      </button>
      <button onClick={() => void removeDataSource('top_quakes')}>
        Remove SQL data source
      </button>
      <button
        onClick={async () => {
          const file = new File(['id,name\n1,Alice'], 'people.csv', {
            type: 'text/csv',
          });
          await addRoomFile(file);
        }}
      >
        Add file
      </button>
    </div>
  );
}
```

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

## Related packages

- `@sqlrooms/sql-editor`
- `@sqlrooms/ai`
- `@sqlrooms/mosaic`
- `@sqlrooms/vega`
