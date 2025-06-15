A powerful wrapper around DuckDB-WASM that provides React hooks and utilities for working with DuckDB in browser environments.

## Features

### React Integration & Type Safety

- **React Hooks**: Seamless integration with React applications via `useSql` and `useRoomStore` hooks
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

## Working with Tables

### Using the Store for Direct Database Operations

```tsx
import {useRoomStore} from '@sqlrooms/duckdb';

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
import {useRoomStore} from '@sqlrooms/duckdb';

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
import {useDuckDb} from '@sqlrooms/duckdb';

function AdvancedDataLoader() {
  const connector = useDuckDb();

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

```tsx
import {useDuckDb, useRoomStore} from '@sqlrooms/duckdb';

async function executeCustomQuery() {
  // Get the connector directly
  const connector = useDuckDb();

  // Execute a query and get Arrow table
  const queryHandle = connector.query('SELECT COUNT(*) as count FROM users');
  const result = await queryHandle.result;

  // Access the Arrow table directly
  const count = result.getChildAt(0)?.get(0);
  console.log(`Total users: ${count}`);

  return result;
}

// Using the store for advanced operations
function AdvancedOperations() {
  const executeSql = useRoomStore((state) => state.db.executeSql);
  const sqlSelectToJson = useRoomStore((state) => state.db.sqlSelectToJson);
  const checkTableExists = useRoomStore((state) => state.db.checkTableExists);

  const handleAdvancedQuery = async () => {
    // Execute with caching and deduplication
    const queryHandle = await executeSql('SELECT * FROM users LIMIT 10');
    if (queryHandle) {
      const result = await queryHandle.result;
      console.log('Query result:', result);
    }

    // Parse SQL query to JSON for analysis
    const parseResult = await sqlSelectToJson('SELECT id, name FROM users');
    console.log('Parsed query:', parseResult);

    // Check if table exists before operating on it
    const exists = await checkTableExists('users');
    console.log('Table exists:', exists);
  };

  return <button onClick={handleAdvancedQuery}>Run Advanced Operations</button>;
}
```

For more information, visit the SQLRooms documentation.

```

```
