SQL editor UI and state slice for SQLRooms apps.

This package provides:

- `createSqlEditorSlice()` for query tabs, execution, and results state
- `SqlEditor` and `SqlEditorModal` UI
- `SqlMonacoEditor` standalone SQL editor
- helpers/components for query results, table structure, and SQL data sources

## Installation

```bash
npm install @sqlrooms/sql-editor @sqlrooms/room-shell @sqlrooms/duckdb @sqlrooms/ui
```

## Store setup

```tsx
import {
  createRoomShellSlice,
  createRoomStore,
  RoomShellSliceState,
} from '@sqlrooms/room-shell';
import {createSqlEditorSlice, SqlEditorSliceState} from '@sqlrooms/sql-editor';

type RoomState = RoomShellSliceState & SqlEditorSliceState;

export const {roomStore, useRoomStore} = createRoomStore<RoomState>(
  (set, get, store) => ({
    ...createRoomShellSlice({
      config: {
        dataSources: [
          {
            type: 'url',
            tableName: 'earthquakes',
            url: 'https://huggingface.co/datasets/sqlrooms/earthquakes/resolve/main/earthquakes.parquet',
          },
        ],
      },
    })(set, get, store),
    ...createSqlEditorSlice()(set, get, store),
  }),
);
```

## Render SQL editor modal

```tsx
import {RoomShell} from '@sqlrooms/room-shell';
import {SqlEditorModal} from '@sqlrooms/sql-editor';
import {useDisclosure} from '@sqlrooms/ui';
import {TerminalIcon} from 'lucide-react';
import {roomStore} from './store';

export function App() {
  const sqlEditor = useDisclosure();

  return (
    <RoomShell roomStore={roomStore} className="h-screen">
      <RoomShell.Sidebar>
        <RoomShell.SidebarButton
          title="SQL Editor"
          icon={TerminalIcon}
          isSelected={sqlEditor.isOpen}
          onClick={sqlEditor.onToggle}
        />
      </RoomShell.Sidebar>
      <RoomShell.LayoutComposer />
      <SqlEditorModal isOpen={sqlEditor.isOpen} onClose={sqlEditor.onClose} />
    </RoomShell>
  );
}
```

## Run queries programmatically

```tsx
import {useRoomStore} from './store';

function RunQueryButton() {
  const parseAndRunQuery = useRoomStore((state) => state.sqlEditor.parseAndRunQuery);
  const createQueryTab = useRoomStore((state) => state.sqlEditor.createQueryTab);

  const run = async () => {
    createQueryTab('SELECT COUNT(*) AS total FROM earthquakes');
    await parseAndRunQuery('SELECT COUNT(*) AS total FROM earthquakes');
  };

  return <button onClick={() => void run()}>Run query</button>;
}
```

## Standalone editor (without SQLRooms store)

`SqlMonacoEditor` can be used independently:

```tsx
import {SqlMonacoEditor} from '@sqlrooms/sql-editor';
import {useState} from 'react';

export function StandaloneEditor() {
  const [sql, setSql] = useState('SELECT 1');
  return <SqlMonacoEditor value={sql} onChange={(v) => setSql(v ?? '')} height="320px" />;
}
```

## Related packages

- `@sqlrooms/sql-editor-config` for persisted SQL editor config schema
- `@sqlrooms/duckdb` for query execution and table state
- `@sqlrooms/schema-tree` for database tree rendering

## Example apps

- https://github.com/sqlrooms/examples/tree/main/query
- https://github.com/sqlrooms/examples/tree/main/query-websocket
