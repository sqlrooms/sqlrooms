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

These components must be used within a `ProjectBuilderProvider` context as they rely on the SQLRooms store:

```tsx
import {ProjectBuilderProvider} from '@sqlrooms/project-builder';
import {SqlEditorModal} from '@sqlrooms/sql-editor';
import {useDisclosure} from '@sqlrooms/ui';
import {projectStore} from './store';

function MyApp() {
  const {isOpen, onOpen, onClose} = useDisclosure();

  return (
    <ProjectBuilderProvider projectStore={projectStore}>
      <div className="my-app">
        <button onClick={isOpen ? onClose : onOpen}>
          {isOpen ? 'Hide' : 'Show'} SQL Editor
        </button>

        <SqlEditorModal isOpen={isOpen} onClose={onClose} />
      </div>
    </ProjectBuilderProvider>
  );
}
```

### Store Setup for SQL Editor

The SQL Editor requires a properly configured store with the SQL Editor slice:

```tsx
import {
  createProjectSlice,
  createProjectStore,
  ProjectState,
} from '@sqlrooms/project-builder';
import {BaseProjectConfig} from '@sqlrooms/project-config';
import {
  createDefaultSqlEditorConfig,
  createSqlEditorSlice,
  SqlEditorSliceConfig,
  SqlEditorSliceState,
} from '@sqlrooms/sql-editor';
import {z} from 'zod';

// Define combined config schema
export const AppConfig = BaseProjectConfig.merge(SqlEditorSliceConfig);
export type AppConfig = z.infer<typeof AppConfig>;

// Define combined state type
export type AppState = ProjectState<AppConfig> & SqlEditorSliceState;

// Create combined store
export const {projectStore, useProjectStore} = createProjectStore<
  AppConfig,
  AppState
>((set, get, store) => ({
  // Base project slice
  ...createProjectSlice<AppConfig>({
    config: {
      title: 'SQL Workspace',
      // ... other project config
      ...createDefaultSqlEditorConfig(),
    },
  })(set, get, store),

  // Sql editor slice
  ...createSqlEditorSlice()(set, get, store),
}));
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
import {ProjectBuilderProvider} from '@sqlrooms/project-builder';
import {projectStore} from './store';

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
    <ProjectBuilderProvider projectStore={projectStore}>
      <button onClick={onOpen}>Open SQL Editor</button>
      <SqlEditorModal
        isOpen={isOpen}
        onClose={onClose}
        schema="analytics"
        documentationPanel={<Documentation />}
      />
    </ProjectBuilderProvider>
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
  createProjectSlice,
  createProjectStore,
  ProjectState,
  ProjectBuilderProvider,
} from '@sqlrooms/project-builder';
import {BaseProjectConfig} from '@sqlrooms/project-config';
import {z} from 'zod';

// 1. Define combined config schema
export const AppConfig = BaseProjectConfig.merge(SqlEditorSliceConfig);
export type AppConfig = z.infer<typeof AppConfig>;

// 2. Define combined state type
export type AppState = ProjectState<AppConfig> & SqlEditorSliceState;

// 3. Create combined store
export const {projectStore, useProjectStore} = createProjectStore<
  AppConfig,
  AppState
>((set, get, store) => ({
  // Base project slice
  ...createProjectSlice<AppConfig>({
    config: {
      title: 'SQL Workspace',
      // ... other project config
      ...createDefaultSqlEditorConfig(),
    },
  })(set, get, store),

  // Sql editor slice
  ...createSqlEditorSlice()(set, get, store),
}));

// 4. Use the store in components
function MyComponent() {
  // Access SQL editor state and actions
  const runQuery = useProjectStore((state) => state.sqlEditor.runQuery);
  const createQueryTab = useProjectStore(
    (state) => state.sqlEditor.createQueryTab,
  );

  // Use actions
  const handleExecute = () => {
    runQuery('SELECT * FROM users LIMIT 10');
  };

  return (
    <ProjectBuilderProvider projectStore={projectStore}>
      <div>
        <button onClick={handleExecute}>Run Query</button>
        <SqlEditorModal isOpen={true} onClose={() => {}} />
      </div>
    </ProjectBuilderProvider>
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

The main component providing a full-featured SQL editor interface. Must be used within a ProjectBuilderProvider.

```tsx
import {SqlEditor} from '@sqlrooms/sql-editor';
import {ProjectBuilderProvider} from '@sqlrooms/project-builder';
import {projectStore} from './store';

<ProjectBuilderProvider projectStore={projectStore}>
  <SqlEditor
    isOpen={boolean}
    onClose={() => void}
    schema="main"
    documentationPanel={ReactNode}
  />
</ProjectBuilderProvider>
```

### SqlMonacoEditor

A standalone SQL-specific Monaco editor component. Can be used independently without ProjectBuilderProvider.

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

A modal wrapper around the SQL editor. Must be used within a ProjectBuilderProvider.

```tsx
import {SqlEditorModal} from '@sqlrooms/sql-editor';
import {useDisclosure} from '@sqlrooms/ui';
import {ProjectBuilderProvider} from '@sqlrooms/project-builder';
import {projectStore} from './store';

function EditorWithModal() {
  const {isOpen, onOpen, onClose} = useDisclosure();

  return (
    <ProjectBuilderProvider projectStore={projectStore}>
      <button onClick={onOpen}>Open SQL Editor</button>
      <SqlEditorModal isOpen={isOpen} onClose={onClose} />
    </ProjectBuilderProvider>
  );
}
```

### CreateTableModal

A modal for creating new tables from SQL queries. Must be used within a ProjectBuilderProvider.

```tsx
import {CreateTableModal} from '@sqlrooms/sql-editor';
import {useDisclosure} from '@sqlrooms/ui';
import {ProjectBuilderProvider} from '@sqlrooms/project-builder';
import {projectStore} from './store';
import {useProjectStore} from './store';

function TableCreator() {
  const {isOpen, onOpen, onClose} = useDisclosure();
  const addOrUpdateSqlQueryDataSource = useProjectStore(
    (state) => state.project.addOrUpdateSqlQueryDataSource,
  );

  return (
    <ProjectBuilderProvider projectStore={projectStore}>
      <button onClick={onOpen}>Create Table from Results</button>
      <CreateTableModal
        isOpen={isOpen}
        onClose={onClose}
        onAddOrUpdateSqlQuery={addOrUpdateSqlQueryDataSource}
        query="SELECT * FROM users"
      />
    </ProjectBuilderProvider>
  );
}
```

### SqlQueryDataSourcesPanel

A panel showing available data sources for SQL queries. Must be used within a ProjectBuilderProvider.

```tsx
import {SqlQueryDataSourcesPanel} from '@sqlrooms/sql-editor';
import {ProjectBuilderProvider} from '@sqlrooms/project-builder';
import {projectStore} from './store';

<ProjectBuilderProvider projectStore={projectStore}>
  <SqlQueryDataSourcesPanel
    onSelectTable={(tableName) => {
      console.log(`Selected table: ${tableName}`);
    }}
  />
</ProjectBuilderProvider>;
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
config.sqlEditor.queries = [
  {id: 'default', name: 'Untitled', query: 'SELECT * FROM users LIMIT 10;'},
];
config.sqlEditor.selectedQueryId = 'default';

// Use in store creation
const {projectStore} = createProjectStore({
  ...createProjectSlice({
    config: {
      ...config,
      // other config options
    },
  }),
  ...createSqlEditorSlice(),
});
```

For more information, visit the SQLRooms documentation.
