This package is part of the SQLRooms framework.

# SQL Editor

A powerful SQL editor component for SQLRooms applications. This package provides React components and hooks for creating interactive SQL query interfaces with Monaco editor integration, table management, and results visualization.

## Features

- 🔍 **Advanced SQL Editing**: Monaco-based SQL editor with syntax highlighting and auto-completion
- 📊 **Data Visualization**: View query results in interactive data tables
- 📑 **Multiple Tabs**: Support for multiple query tabs with save/rename/delete functionality
- 🔄 **State Management**: Zustand-based state management for SQL editor state
- 📦 **Table Management**: Browser for tables in the database with schema information
- 📤 **Data Export**: Export query results to CSV files
- 📝 **Documentation**: Optional documentation panel for SQL reference

## Installation

```bash
npm install @sqlrooms/sql-editor
```

## Basic Usage

### SqlEditor and SqlEditorModal Components

These components must be used within a `RoomShell` which provides the room store context as they rely on the SQLRooms store:

```tsx
import {RoomShell} from '@sqlrooms/room-shell';
import {SqlEditorModal} from '@sqlrooms/sql-editor';
import {useDisclosure} from '@sqlrooms/ui';
import {TerminalIcon} from 'lucide-react';
import {roomStore} from './store';

function MyApp() {
  const sqlEditorDisclosure = useDisclosure();

  return (
    <RoomShell className="h-screen" roomStore={roomStore}>
      <RoomShell.Sidebar>
        <RoomShell.SidebarButton
          title="SQL Editor"
          onClick={sqlEditorDisclosure.onToggle}
          isSelected={false}
          icon={TerminalIcon}
        />
      </RoomShell.Sidebar>
      <RoomShell.LayoutComposer />
      <RoomShell.LoadingProgress />
      <SqlEditorModal
        isOpen={sqlEditorDisclosure.isOpen}
        onClose={sqlEditorDisclosure.onClose}
      />
    </RoomShell>
  );
}
```

### Store Setup for SQL Editor

The SQL Editor requires a properly configured store with the SQL Editor slice:

```tsx
import {
  createRoomShellSlice,
  createRoomStore,
  RoomState,
} from '@sqlrooms/room-shell';
import {BaseRoomConfig} from '@sqlrooms/room-config';
import {
  createDefaultSqlEditorConfig,
  createSqlEditorSlice,
  SqlEditorSliceConfig,
  SqlEditorSliceState,
} from '@sqlrooms/sql-editor';
import {z} from 'zod';

// Define combined config schema
export const RoomConfig = BaseRoomConfig.merge(SqlEditorSliceConfig);
export type RoomConfig = z.infer<typeof RoomConfig>;

// Define combined state type
export type RoomState = RoomState<RoomConfig> & SqlEditorSliceState;

// Create combined store
export const {roomStore, useRoomStore} = createRoomStore<RoomConfig, RoomState>(
  (set, get, store) => ({
    // Base room slice
    ...createRoomShellSlice<RoomConfig>({
      config: {
        title: 'SQL Workspace',
      },
    })(set, get, store),

    // Sql editor slice
    ...createSqlEditorSlice()(set, get, store),
  }),
);
```

### Standalone SqlMonacoEditor Component

Unlike the full SQL Editor components, the `SqlMonacoEditor` can be used as a standalone component without requiring the store:

```tsx
import {SqlMonacoEditor} from '@sqlrooms/sql-editor';
import {useState} from 'react';

function SimpleSqlEditor() {
  const [query, setQuery] = useState('SELECT * FROM products');

  const handleExecute = () => {
    // Execute the query using your own logic
    console.log('Executing query:', query);
  };

  return (
    <>
      <SqlMonacoEditor value={query} onChange={setQuery} height="400px" />
      <button onClick={handleExecute}>Execute</button>
    </>
  );
}
```

### With Custom Documentation Panel

Adding a custom documentation panel to the SQL Editor:

```tsx
import {SqlEditorModal} from '@sqlrooms/sql-editor';
import {useDisclosure} from '@sqlrooms/ui';
import {RoomShell} from '@sqlrooms/room-shell';
import {roomStore} from './store';

function AdvancedSqlEditor() {
  const {isOpen, onOpen, onClose} = useDisclosure();

  // Custom documentation component
  const Documentation = () => (
    <div className="p-4">
      <h2 className="mb-4 text-xl font-bold">SQL Reference</h2>
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">SELECT</h3>
          <p>Retrieves data from a table</p>
          <pre className="mt-2 rounded bg-gray-100 p-2">
            SELECT column1, column2 FROM table_name;
          </pre>
        </div>
        {/* More documentation items */}
      </div>
    </div>
  );

  return (
    <SqlEditorModal
      isOpen={isOpen}
      onClose={onClose}
      documentationPanel={<Documentation />}
    />
  );
}
```

## State Management

The SQL editor provides a Zustand slice for managing state. Here's how to set it up:

### Using in a Combined SQLRooms Store

This approach is recommended when integrating multiple SQLRooms components:

```tsx
import {
  createSqlEditorSlice,
  createDefaultSqlEditorConfig,
  SqlEditorSliceState,
  SqlEditorSliceConfig,
} from '@sqlrooms/sql-editor';
import {
  createRoomShellSlice,
  createRoomStore,
  RoomState,
  RoomShell,
} from '@sqlrooms/room-shell';
import {BaseRoomConfig} from '@sqlrooms/room-config';
import {z} from 'zod';

// 1. Define combined config schema
export const RoomConfig = BaseRoomConfig.merge(SqlEditorSliceConfig);
export type RoomConfig = z.infer<typeof RoomConfig>;

// 2. Define combined state type
export type RoomState = RoomState<RoomConfig> & SqlEditorSliceState;

// 3. Create combined store
export const {roomStore, useRoomStore} = createRoomStore<RoomConfig, RoomState>(
  (set, get, store) => ({
    // Base room slice
    ...createRoomShellSlice<RoomConfig>({
      config: {
        title: 'SQL Workspace',
      },
    })(set, get, store),

    // Sql editor slice
    ...createSqlEditorSlice()(set, get, store),
  }),
);

// 4. Use the store in components
function MyComponent() {
  // Access SQL editor state and actions
  const runQuery = useRoomStore((state) => state.sqlEditor.runQuery);
  const createQueryTab = useRoomStore(
    (state) => state.sqlEditor.createQueryTab,
  );

  // Use actions
  const handleExecute = () => {
    runQuery('SELECT * FROM users LIMIT 10');
    runQuery('SELECT * FROM users LIMIT 10');
  };

  return (
    <RoomShell roomStore={roomStore}>
      <div>
        <button onClick={handleExecute}>Run Query</button>
        <SqlEditorModal isOpen={true} onClose={() => {}} />
      </div>
    </RoomShell>
  );
}
```

### Available State Actions

- `sqlEditor.runQuery(query: string)`: Execute a SQL query
- `sqlEditor.createQueryTab(initialQuery?: string)`: Create a new query tab
- `sqlEditor.deleteQueryTab(queryId: string)`: Delete a query tab
- `sqlEditor.renameQueryTab(queryId: string, newName: string)`: Rename a query tab
- `sqlEditor.updateQueryText(queryId: string, queryText: string)`: Update query text
- `sqlEditor.setSelectedQueryId(queryId: string)`: Set the selected query tab
- `sqlEditor.getCurrentQuery(defaultQuery?: string)`: Get current query text

## Available Components

### SqlEditor

The main component providing a full-featured SQL editor interface. Must be used within a RoomShell.

```tsx
import {SqlEditor} from '@sqlrooms/sql-editor';
import {RoomShell} from '@sqlrooms/room-shell';
import {roomStore} from './store';

<RoomShell roomStore={roomStore}>
  <SqlEditor
    isOpen={boolean}
    onClose={() => void}
    schema="main"
    documentationPanel={ReactNode}
  />
</RoomShell>
```

### SqlMonacoEditor

A standalone SQL-specific Monaco editor component. Can be used independently without RoomShell.

```tsx
import {SqlMonacoEditor} from '@sqlrooms/sql-editor';
import {useState} from 'react';

function SimpleSqlEditor() {
  const [query, setQuery] = useState('SELECT * FROM products');

  const handleExecute = () => {
    // Execute the query using your own logic
    console.log('Executing query:', query);
  };

  return (
    <>
      <SqlMonacoEditor value={query} onChange={setQuery} height="400px" />
      <button onClick={handleExecute}>Execute</button>
    </>
  );
}
```

### SqlEditorModal

A modal wrapper around the SQL editor. Must be used within a RoomShell.

```tsx
import {SqlEditorModal} from '@sqlrooms/sql-editor';
import {useDisclosure} from '@sqlrooms/ui';
import {RoomShell} from '@sqlrooms/room-shell';
import {roomStore} from './store';

function EditorWithModal() {
  const {isOpen, onOpen, onClose} = useDisclosure();

  return (
    <RoomShell roomStore={roomStore}>
      <button onClick={onOpen}>Open SQL Editor</button>
      <SqlEditorModal isOpen={isOpen} onClose={onClose} />
    </RoomShell>
  );
}
```

### CreateTableModal

A modal for creating new tables from SQL queries. Must be used within a RoomShell.

```tsx
import {CreateTableModal} from '@sqlrooms/sql-editor';
import {useDisclosure} from '@sqlrooms/ui';
import {RoomShell} from '@sqlrooms/room-shell';
import {roomStore} from './store';
import {useRoomStore} from './store';

function TableCreator() {
  const {isOpen, onOpen, onClose} = useDisclosure();
  const addOrUpdateSqlQueryDataSource = useRoomStore(
    (state) => state.room.addOrUpdateSqlQueryDataSource,
  );

  return (
    <RoomShell roomStore={roomStore}>
      <button onClick={onOpen}>Create Table from Results</button>
      <CreateTableModal
        isOpen={isOpen}
        onClose={onClose}
        onAddOrUpdateSqlQuery={addOrUpdateSqlQueryDataSource}
        query="SELECT * FROM users"
      />
    </RoomShell>
  );
}
```

### SqlQueryDataSourcesPanel

A panel showing available data sources for SQL queries. Must be used within a RoomShell.

```tsx
import {SqlQueryDataSourcesPanel} from '@sqlrooms/sql-editor';
import {RoomShell} from '@sqlrooms/room-shell';
import {roomStore} from './store';

<RoomShell roomStore={roomStore}>
  <SqlQueryDataSourcesPanel
    onSelectTable={(tableName) => {
      console.log(`Selected table: ${tableName}`);
    }}
  />
</RoomShell>;
```

## Props

### SqlEditor Props

| Prop               | Type      | Default   | Description                           |
| ------------------ | --------- | --------- | ------------------------------------- |
| isOpen             | boolean   | -         | Whether the editor is open            |
| onClose            | function  | -         | Callback when the editor is closed    |
| schema             | string    | 'main'    | Default schema to use for queries     |
| documentationPanel | ReactNode | undefined | Custom documentation panel to display |

### SqlMonacoEditor Props

| Prop             | Type        | Default | Description                             |
| ---------------- | ----------- | ------- | --------------------------------------- |
| value            | string      | ''      | The SQL query text                      |
| onChange         | function    | -       | Callback when the query text changes    |
| height           | string      | '300px' | Height of the editor                    |
| readOnly         | boolean     | false   | Whether the editor is read-only         |
| theme            | string      | 'dark'  | Editor theme ('dark' or 'light')        |
| tableSchemas     | DataTable[] | []      | Table schemas for autocompletion        |
| customKeywords   | string[]    | []      | Custom SQL keywords for autocompletion  |
| customFunctions  | string[]    | []      | Custom SQL functions for autocompletion |
| getLatestSchemas | function    | -       | Callback to get latest table schemas    |
| className        | string      | -       | Additional CSS class names              |
| options          | object      | -       | Monaco editor options                   |
| onMount          | function    | -       | Callback when editor is mounted         |

### SqlEditorModal Props

| Prop               | Type      | Default   | Description                           |
| ------------------ | --------- | --------- | ------------------------------------- |
| isOpen             | boolean   | -         | Whether the modal is open             |
| onClose            | function  | -         | Callback when the modal is closed     |
| schema             | string    | 'main'    | Default schema to use for queries     |
| documentationPanel | ReactNode | undefined | Custom documentation panel to display |

### CreateTableModal Props

| Prop                  | Type     | Default | Description                       |
| --------------------- | -------- | ------- | --------------------------------- |
| isOpen                | boolean  | -       | Whether the modal is open         |
| onClose               | function | -       | Callback when the modal is closed |
| onAddOrUpdateSqlQuery | function | -       | Callback when a table is created  |
| query                 | string   | -       | SQL query that generated the data |

## Configuration

The SQL editor can be configured through the Zustand store.

```tsx
const config = createDefaultSqlEditorConfig();
// Customize if needed
sqlEditor.config.queries = [
  {id: 'default', name: 'Untitled', query: 'SELECT * FROM users LIMIT 10;'},
];
sqlEditor.config.selectedQueryId = 'default';

// Use in store creation
const {roomStore} = createRoomStore({
  ...createRoomShellSlice({
    config: {
      ...config,
      // other config options
    },
  }),
  ...createSqlEditorSlice(),
});
```

For more information, visit the SQLRooms documentation.
