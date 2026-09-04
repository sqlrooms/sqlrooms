SQL editor UI and state slice for SQLRooms apps.

This package provides:

- `createSqlEditorSlice()` for query tabs, execution, and results state
- `SqlEditor` and `SqlEditorModal` UI
- `SqlQuery` compound components and `SqlQueryBlock` for reusable single-query
  surfaces
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
import {Button} from '@sqlrooms/ui';

function RunQueryButton() {
  const parseAndRunQuery = useRoomStore(
    (state) => state.sqlEditor.parseAndRunQuery,
  );
  const createQueryTab = useRoomStore(
    (state) => state.sqlEditor.createQueryTab,
  );

  const run = async () => {
    createQueryTab('SELECT COUNT(*) AS total FROM earthquakes');
    await parseAndRunQuery('SELECT COUNT(*) AS total FROM earthquakes');
  };

  return <Button onClick={() => void run()}>Run query</Button>;
}
```

For reusable single-query surfaces, use id-addressable query actions:

```tsx
const ensureQuery = useRoomStore((state) => state.sqlEditor.ensureQuery);
const runQueryById = useRoomStore((state) => state.sqlEditor.runQueryById);

ensureQuery('query-1', {name: 'Top Airports', query: 'SELECT * FROM airports'});
await runQueryById('query-1');
```

### Cancelling queries

`abortQueryById(queryId)` (or `abortCurrentQuery()`) cancels a running query.
The result transitions to `status: 'aborted'` **immediately** — it does not
wait for the underlying query promise to settle — so the UI never gets stuck
while a slow/blocked connector unwinds.

Cancellation is **best-effort**: `AbortController.abort()` signals the
connector, but not every connector can actually stop an in-flight statement
server-side. This is reflected on the `QueryResult`:

- While running, a `loading` result is stamped with `isWrite` once the
  statement is parsed (`true` for a non-`SELECT` or multi-statement query).
- On cancel, an `aborted` result carries a `warning` string **only for writes**
  (or a statement whose type isn't known yet): the statement may still complete
  on the backend even though the UI reports it aborted. Reads are aborted
  silently (a late result is simply discarded), so no warning is shown.

`QueryResultPanel` renders the `warning` beneath the "Query was aborted"
message.

For true server-side cancellation, honor the **`AbortSignal`** inside your
connector's `executeQueryInternal(sql, signal)`: the SQL editor cancels by
aborting the signal passed to `connector.query(sql, {signal})`, so a connector
must watch `signal` (e.g. abort the in-flight request and/or interrupt the
backend statement) to actually stop the work. Note that `cancelQueryInternal`
is **not** invoked on this path — it only runs via `QueryHandle.cancel()`, which
the editor does not use — so implementing `cancelQueryInternal` alone will not
stop editor-initiated queries.

## Single Query UI

`SqlQuery` is a compound component for rearranging and styling a single query
experience without the full tabbed workbench:

```tsx
import {SqlQuery} from '@sqlrooms/sql-editor';

export function QueryBlock() {
  return (
    <SqlQuery.Root queryId="query-1" name="Top Airports">
      <SqlQuery.Header title="Top Airports">
        <SqlQuery.Actions />
      </SqlQuery.Header>
      <SqlQuery.Editor />
      <SqlQuery.Results />
    </SqlQuery.Root>
  );
}
```

`SqlQuery.Results` accepts the same props as `QueryResultPanel`, including
`footerDetails` for small metadata rendered at the end of the result footer and
`dataTableClassName` for styling the inner paginated table.

Use `createSqlQueryBlockDefinition()` when a SQL query should be both embeddable
as a stateful block and openable as an artifact shell.

## Standalone editor (without SQLRooms store)

`SqlMonacoEditor` can be used independently:

```tsx
import {SqlMonacoEditor} from '@sqlrooms/sql-editor';
import {useState} from 'react';

export function StandaloneEditor() {
  const [sql, setSql] = useState('SELECT 1');
  return (
    <SqlMonacoEditor
      value={sql}
      onChange={(v) => setSql(v ?? '')}
      height="320px"
    />
  );
}
```

## Related packages

- `@sqlrooms/sql-editor-config` for persisted SQL editor config schema
- `@sqlrooms/duckdb` for query execution and table state
- `@sqlrooms/schema-tree` for database tree rendering

## Example apps

- https://github.com/sqlrooms/examples/tree/main/query
- https://github.com/sqlrooms/examples/tree/main/query-websocket
