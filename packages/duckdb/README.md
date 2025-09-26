A powerful wrapper around DuckDB-WASM that provides React hooks and utilities for working with DuckDB in browser environments.

## Features

### React Integration & Type Safety

- **React Hooks**: Seamless integration with React applications via `useSql`
- **Runtime Validation**: Optional Zod schema validation for query results with type transformations
- **Typed Row Accessors**: Type-safe row access with validation and multiple iteration methods

### Data Management

- **File Operations**: Import data from various file formats (CSV, JSON, Parquet) with auto-detection
- **Arrow Integration**: Work directly with Apache Arrow tables for efficient columnar data processing
- **Schema Management**: Comprehensive database, schema, and table discovery and management
- **Qualified Table Names**: Full support for `database.schema.table` naming convention

### Performance & Operations

- **Query Deduplication**: Automatic deduplication of identical running queries to prevent duplicate execution
- **Query Cancellation**: Cancel running queries with full composability support via `QueryHandle` interface ([learn more](https://sqlrooms.org/query-cancellation))
- **Data Export**: Export query results to CSV files with pagination for large datasets
- **Batch Processing**: Handle large datasets efficiently with built-in pagination support

## Installation

```bash
npm install @sqlrooms/duckdb
```

## Basic Usage

### Using the SQL Hook

```tsx
import {useSql} from '@sqlrooms/duckdb';

function UserList() {
  // Basic usage with TypeScript types
  const {data, isLoading, error} = useSql<{id: number; name: string}>({
    query: 'SELECT id, name FROM users',
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!data) return null;

  return (
    <ul>
      {Array.from(data.rows()).map((user) => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}
```

For more information and examples on using the `useSql` hook, see the [useSql API documentation](/api/duckdb/functions/useSql).

### Using Zod for Runtime Validation

```tsx
import {useSql} from '@sqlrooms/duckdb';
import {z} from 'zod';

const userSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
  created_at: z.string().transform((str) => new Date(str)),
});

function ValidatedUserList() {
  const {data, isLoading, error} = useSql(userSchema, {
    query: 'SELECT id, name, email, created_at FROM users',
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) {
    if (error instanceof z.ZodError) {
      return <div>Validation Error: {error.errors[0].message}</div>;
    }
    return <div>Error: {error.message}</div>;
  }
  if (!data) return null;

  return (
    <ul>
      {data.toArray().map((user) => (
        <li key={user.id}>
          {user.name} ({user.email}) - Joined:{' '}
          {user.created_at.toLocaleDateString()}
        </li>
      ))}
    </ul>
  );
}
```

### Accessing the Underlying Arrow Table and Schema

You can access the underlying Arrow table and schema of a `useSql()` query result. This is especially useful if you want to pass the data to a library that expect an Apache Arrow Table as input without additional data transformation:

```tsx
import {useSql} from '@sqlrooms/duckdb';

function ArrowTableSchemaExample() {
  const {data, isLoading, error} = useSql({
    query: 'SELECT id, name FROM users',
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!data || !data.arrowTable) return null;

  const {arrowTable} = data;
  const fields = arrowTable.schema.fields;
  const numRows = arrowTable.numRows;

  return (
    <table>
      <thead>
        <tr>
          {fields.map((field) => (
            <th key={field.name}>{field.name}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({length: numRows}).map((_, rowIdx) => (
          <tr key={rowIdx}>
            {fields.map((field, colIdx) => (
              <td key={field.name}>
                {String(arrowTable.getChildAt(colIdx)?.get(rowIdx) ?? '')}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

## Working with Tables

### Using the Store for Direct Database Operations

```tsx
function DatabaseManager() {
  const createTableFromQuery = useRoomStore(
    (state) => state.db.createTableFromQuery,
  );
  const addTable = useRoomStore((state) => state.db.addTable);
  const dropTable = useRoomStore((state) => state.db.dropTable);
  const tables = useRoomStore((state) => state.db.tables);
  const refreshTableSchemas = useRoomStore(
    (state) => state.db.refreshTableSchemas,
  );

  // Create a table from a query
  const handleCreateTable = async () => {
    const result = await createTableFromQuery(
      'filtered_users',
      'SELECT * FROM users WHERE active = true',
    );
    console.log(`Created table with ${result.rowCount} rows`);
  };

  // Add a table from JavaScript objects
  const handleAddTable = async () => {
    const users = [
      {id: 1, name: 'Alice', email: 'alice@example.com'},
      {id: 2, name: 'Bob', email: 'bob@example.com'},
    ];
    await addTable('new_users', users);
  };

  // Drop a table
  const handleDropTable = async () => {
    await dropTable('old_table');
  };

  return (
    <div>
      <button onClick={handleCreateTable}>Create Filtered Users Table</button>
      <button onClick={handleAddTable}>Add New Users Table</button>
      <button onClick={handleDropTable}>Drop Old Table</button>
      <button onClick={refreshTableSchemas}>Refresh Schemas</button>

      <h3>Available Tables:</h3>
      <ul>
        {tables.map((table) => (
          <li key={table.table.toString()}>
            {table.table.toString()} ({table.columns.length} columns)
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### Working with Qualified Table Names

```tsx
import {makeQualifiedTableName} from '@sqlrooms/duckdb';

// Support for database.schema.table naming
const qualifiedTable = makeQualifiedTableName({
  database: 'mydb',
  schema: 'public',
  table: 'users',
});

// Use with table operations
await createTableFromQuery(qualifiedTable, 'SELECT * FROM source_table');
await dropTable(qualifiedTable);
const tableExists = await checkTableExists(qualifiedTable);
```

## Loading Data from Files

### Using Load Functions Directly

```tsx
import {loadCSV, loadJSON, loadParquet, loadObjects} from '@sqlrooms/duckdb';

function DataLoader() {
  const getConnector = useRoomStore((state) => state.db.getConnector);

  const handleLoadCSV = async (file: File) => {
    const connector = await getConnector();

    // Generate SQL to load CSV file
    const sql = loadCSV('my_table', file.name, {
      auto_detect: true,
      replace: true,
    });

    // Execute the load operation
    await connector.query(sql).result;
  };

  const handleLoadObjects = async () => {
    const connector = await getConnector();
    const data = [
      {id: 1, name: 'Alice'},
      {id: 2, name: 'Bob'},
    ];

    // Generate SQL to load objects
    const sql = loadObjects('users', data, {replace: true});
    await connector.query(sql).result;
  };

  return (
    <div>
      <input
        type="file"
        accept=".csv"
        onChange={(e) => {
          if (e.target.files?.[0]) handleLoadCSV(e.target.files[0]);
        }}
      />
      <button onClick={handleLoadObjects}>Load Sample Data</button>
    </div>
  );
}
```

### Using the Connector Directly

```tsx
function AdvancedDataLoader() {
  const connector = useRoomStore((state) => state.db.connector);

  const handleFileUpload = async (file: File) => {
    // Load file directly using the connector
    await connector.loadFile(file, 'uploaded_data', {
      method: 'auto', // Auto-detect file type
      replace: true,
      temp: false,
    });
  };

  const handleLoadArrowTable = async (arrowTable: arrow.Table) => {
    // Load Arrow table directly
    await connector.loadArrow(arrowTable, 'arrow_data');
  };

  return (
    <input
      type="file"
      accept=".csv,.json,.parquet"
      onChange={(e) => {
        if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
      }}
    />
  );
}
```

## Exporting Data to CSV

```tsx
import {useExportToCsv} from '@sqlrooms/duckdb';

function ExportButton() {
  const {exportToCsv} = useExportToCsv();

  const handleExport = async () => {
    await exportToCsv('SELECT * FROM users ORDER BY name', 'users_export.csv');
  };

  return <button onClick={handleExport}>Export to CSV</button>;
}
```

## Low-Level DuckDB Access

### Basic direct usage

```tsx
async function executeCustomQuery() {
  // Grab the connector directly (no React hook necessary inside plain TS)
  const connector = useRoomStore((state) => state.db.connector);

  // QueryHandle is promise-like – await it directly
  const result = await connector.query('SELECT COUNT(*) AS count FROM users');

  // Inspect Arrow table
  const count = result.getChildAt(0)?.get(0);
  console.log(`Total users: ${count}`);
}
```

### Cancellation examples

```tsx
async function cancelExample() {
  const connector = useRoomStore((state) => state.db.connector);

  // 1. Manual cancel via the handle
  const query = connector.query('SELECT * FROM large_table');
  setTimeout(() => h.cancel(), 2000); // cancel after 2 s
  await query; // throws if cancelled

  // 2. Composable cancellation – many queries, one controller
  const controller = new AbortController();
  const q1 = connector.query('SELECT 1', {signal: controller.signal});
  const q2 = connector.query('SELECT 2', {signal: controller.signal});
  controller.abort(); // cancels q1 & q2
  await Promise.allSettled([q1, q2]);
}
```

### Advanced operations with the Zustand store

```tsx
function AdvancedOperations() {
  const executeSql = useRoomStore((s) => s.db.executeSql);
  const sqlSelectToJson = useRoomStore((s) => s.db.sqlSelectToJson);
  const checkTableExists = useRoomStore((s) => s.db.checkTableExists);

  const handleAdvancedQuery = async () => {
    // Cached execution with deduplication
    const query = await executeSql('SELECT * FROM users LIMIT 10');
    if (query) {
      const rows = await query; // await handle directly
      console.log('Query result:', rows);
    }

    // Parse SQL to JSON (analysis tool)
    const parsed = await sqlSelectToJson('SELECT id, name FROM users');
    console.log('Parsed query:', parsed);

    // Safety check before destructive operations
    const exists = await checkTableExists('users');
    console.log('Table exists:', exists);
  };

  return <button onClick={handleAdvancedQuery}>Run Advanced Operations</button>;
}
```

For more information, visit the SQLRooms documentation.

## Multiple Statements Support

The DuckDB connectors now support executing multiple SQL statements in a single call by passing an array of strings instead of a single string:

```typescript
import {createWasmDuckDbConnector} from '@sqlrooms/duckdb';

const connector = createWasmDuckDbConnector();
await connector.initialize();

// Execute multiple statements
const queries = [
  'CREATE TABLE users (id INTEGER, name VARCHAR)',
  "INSERT INTO users VALUES (1, 'Alice')",
  "INSERT INTO users VALUES (2, 'Bob')",
  'SELECT COUNT(*) as user_count FROM users',
];

const result = await connector.query(queries);
console.log(result.get(0)?.user_count); // Output: 2
```

### Key Features

- **Sequential Execution**: Statements are executed in order, one after another
- **Last Result Returned**: Only the result from the last statement is returned
- **Performance Optimized**: Intermediate statements (CREATE, INSERT, etc.) are executed efficiently without building full result tables
- **Error Handling**: If any statement fails, execution stops and an error is thrown
- **Cancellation Support**: The entire operation can be cancelled using AbortSignal
- **Empty Statement Handling**: Empty or whitespace-only statements are automatically skipped

### Compatibility

This feature is compatible with both WasmDuckDbConnector and WasmMotherDuckDbConnector. Each statement is executed individually to ensure compatibility with older DuckDB versions that don't support multiple statements in a single call.
