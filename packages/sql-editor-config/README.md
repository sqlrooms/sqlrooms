# @sqlrooms/sql-editor-config

Zod schema and defaults for persisted SQL editor state.

## Installation

```bash
npm install @sqlrooms/sql-editor-config
```

## Exports

- `SqlEditorSliceConfig`
- `createDefaultSqlEditorConfig()`

## Basic usage

```ts
import {
  SqlEditorSliceConfig,
  createDefaultSqlEditorConfig,
} from '@sqlrooms/sql-editor-config';

const defaultSqlEditorConfig = createDefaultSqlEditorConfig();

const validated = SqlEditorSliceConfig.parse({
  queries: [
    {
      id: 'q1',
      name: 'Top earthquakes',
      query: 'SELECT * FROM earthquakes ORDER BY Magnitude DESC LIMIT 100',
    },
  ],
  selectedQueryId: 'q1',
  openTabs: ['q1'],
});
```

## Migration behavior

`SqlEditorSliceConfig` includes migration logic for legacy persisted data:

- if `openTabs` is missing and legacy `closedTabIds` is present, it computes `openTabs`
- this helps old saved configs continue to load without manual migration steps

## Use with persistence

```ts
import {SqlEditorSliceConfig} from '@sqlrooms/sql-editor-config';
import {
  createRoomStore,
  persistSliceConfigs,
  createRoomShellSlice,
} from '@sqlrooms/room-shell';

const persistence = {
  name: 'my-editor-storage',
  sliceConfigSchemas: {
    sqlEditor: SqlEditorSliceConfig,
  },
};

createRoomStore(
  persistSliceConfigs(persistence, (set, get, store) => ({
    ...createRoomShellSlice({
      config: {title: 'Editor App', dataSources: []},
    })(set, get, store),
  })),
);
```
