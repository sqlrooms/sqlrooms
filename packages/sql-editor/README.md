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

### Simple SQL Editor

```tsx
import {SqlEditor} from '@sqlrooms/sql-editor';

function MySqlEditor() {
  const [isOpen, setIsOpen] = useState(true);

  return <SqlEditor isOpen={isOpen} onClose={() => setIsOpen(false)} />;
}
```

### With Custom Schema and Documentation

```tsx
import {SqlEditor} from '@sqlrooms/sql-editor';

function AdvancedSqlEditor() {
  const [isOpen, setIsOpen] = useState(true);

  // Custom documentation component
  const Documentation = () => (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">SQL Reference</h2>
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">SELECT</h3>
          <p>Retrieves data from a table</p>
          <pre className="bg-gray-100 p-2 rounded mt-2">
            SELECT column1, column2 FROM table_name;
          </pre>
        </div>
        {/* More documentation items */}
      </div>
    </div>
  );

  return (
    <SqlEditor
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      schema="analytics"
      documentationPanel={<Documentation />}
    />
  );
}
```

## Available Components

### SqlEditor

The main component providing a full-featured SQL editor interface.

```tsx
import {SqlEditor} from '@sqlrooms/sql-editor';

<SqlEditor
  isOpen={boolean}
  onClose={() => void}
  schema="main"
  documentationPanel={ReactNode}
/>
```

### SqlMonacoEditor

A standalone SQL-specific Monaco editor component.

```tsx
import {SqlMonacoEditor} from '@sqlrooms/sql-editor';

<SqlMonacoEditor
  value="SELECT * FROM users"
  onChange={(value) => console.log(value)}
  onExecuteQuery={() => executeQuery()}
/>;
```

### SqlEditorModal

A modal wrapper around the SQL editor.

```tsx
import {SqlEditorModal} from '@sqlrooms/sql-editor';

<SqlEditorModal isOpen={isOpen} onClose={() => setIsOpen(false)} />;
```

### CreateTableModal

A modal for creating new tables from SQL queries.

```tsx
import {CreateTableModal} from '@sqlrooms/sql-editor';

<CreateTableModal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  onCreateTable={(tableName) => console.log(`Created table: ${tableName}`)}
  tableData={queryResults}
/>;
```

### SqlQueryDataSourcesPanel

A panel showing available data sources for SQL queries.

```tsx
import {SqlQueryDataSourcesPanel} from '@sqlrooms/sql-editor';

<SqlQueryDataSourcesPanel
  onSelectTable={(tableName) => {
    console.log(`Selected table: ${tableName}`);
  }}
/>;
```

## State Management

The SQL editor provides a Zustand slice for managing state. You can use it in two ways:

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
} from '@sqlrooms/project-builder';
import {BaseProjectConfig} from '@sqlrooms/project-config';
import {
  createAiSlice,
  createDefaultAiConfig,
  AiSliceState,
  AiSliceConfig,
} from '@sqlrooms/ai';
import {z} from 'zod';

// 1. Define combined config schema
export const AppConfig =
  BaseProjectConfig.merge(SqlEditorSliceConfig).merge(AiSliceConfig);
export type AppConfig = z.infer<typeof AppConfig>;

// 2. Define combined state type
export type AppState = ProjectState<AppConfig> &
  SqlEditorSliceState &
  AiSliceState;

// 3. Create combined store
export const {projectStore, useProjectStore} = createProjectStore<
  AppConfig,
  AppState
>((set, get, store) => ({
  // Base project slice
  ...createProjectSlice<AppConfig>({
    project: {
      config: {
        title: 'SQL Workspace',
        // ... other project config
        ...createDefaultSqlEditorConfig(),
        ...createDefaultAiConfig(),
      },
      // ... panels config
    },
  })(set, get, store),

  // Sql editor slice
  ...createSqlEditorSlice()(set, get, store),

  // Ai slice
  ...createAiSlice()(set, get, store),
}));

// 4. Use the store in components
function MyComponent() {
  // Access SQL editor state and actions
  const executeQuery = useProjectStore((state) => state.executeQuery);
  const createQueryTab = useProjectStore((state) => state.createQueryTab);

  // Use actions
  const handleExecute = () => {
    executeQuery('SELECT * FROM users LIMIT 10');
  };

  return (
    <div>
      <button onClick={handleExecute}>Run Query</button>
      <SqlEditor store={useProjectStore} />
    </div>
  );
}
```

### Standalone SQL Editor Store

For simpler use cases where you only need the SQL editor:

```tsx
// Create default configuration
const config = createDefaultSqlEditorConfig();

// Create a store with the SQL editor slice
const useStore = createProjectStore({
  sqlEditor: createSqlEditorSlice(config),
});

// Use the store in components with the provided selector hook
const {executeQuery, getCurrentQuery} = useStoreWithSqlEditor(useStore);
```

### Available State Actions

- `executeQuery(query: string, schema?: string)`: Execute a SQL query
- `exportResultsToCsv(results: Table, filename?: string)`: Export results to CSV
- `createQueryTab(initialQuery?: string)`: Create a new query tab
- `deleteQueryTab(queryId: string)`: Delete a query tab
- `renameQueryTab(queryId: string, newName: string)`: Rename a query tab
- `updateQueryText(queryId: string, queryText: string)`: Update query text
- `setSelectedQueryId(queryId: string)`: Set the selected query tab
- `getCurrentQuery(defaultQuery?: string)`: Get current query text

## Configuration

The SQL editor can be configured through the Zustand store.

```tsx
const config = {
  sqlEditor: {
    queries: [
      {id: 'default', name: 'Untitled', query: 'SELECT * FROM users LIMIT 10;'},
    ],
    selectedQueryId: 'default',
  },
};
```

## Integration with DuckDB

This package integrates with `@sqlrooms/duckdb` for query execution and table management.

```tsx
import {getDuckDb} from '@sqlrooms/duckdb';
import {Table} from 'apache-arrow';

// Execute a query directly
async function runQuery(query: string): Promise<Table> {
  const db = await getDuckDb();
  return db.query(query);
}
```

## Advanced Features

- **Custom Monaco Configuration**: Customize editor settings and SQL language support
- **Tab Management**: Create, rename, and delete query tabs
- **Table Creation**: Create new tables from query results
- **Table Schema Inspection**: View table schemas and column types
- **Export Functionality**: Export query results to various formats

For more information, visit the SQLRooms documentation.
