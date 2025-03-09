A powerful wrapper around DuckDB-WASM that provides React hooks and utilities for working with DuckDB in browser environments.

## Features

- 🔄 **React Integration**: Hooks for seamless integration with React applications
- 📊 **Type-Safe Queries**: Execute SQL queries with TypeScript type safety
- 🔍 **Data Validation**: Optional runtime validation using Zod schemas
- 📁 **File Operations**: Import data from various file formats (CSV, JSON, Parquet)
- 📤 **Data Export**: Export query results to CSV files
- 🏹 **Arrow Integration**: Work with Apache Arrow tables for efficient data processing

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

### Creating Tables from Different Sources

```tsx
import {
  createTableFromQuery,
  createTableFromObjects,
  createViewFromFile,
} from '@sqlrooms/duckdb';

// Create a table from a SQL query
await createTableFromQuery(
  'filtered_users',
  'SELECT * FROM users WHERE active = true',
);

// Create a table from JavaScript objects
const users = [
  {id: 1, name: 'Alice', email: 'alice@example.com'},
  {id: 2, name: 'Bob', email: 'bob@example.com'},
];
await createTableFromObjects('new_users', users);

// Create a view from a file upload
function FileUploader() {
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (file) {
      await createViewFromFile(file.name, 'main', 'uploaded_data', file);
    }
  };

  return (
    <input
      type="file"
      accept=".csv,.json,.parquet"
      onChange={handleFileUpload}
    />
  );
}
```

### Exporting Data to CSV

```tsx
import {exportToCsv} from '@sqlrooms/duckdb';

function ExportButton() {
  const handleExport = async () => {
    await exportToCsv('SELECT * FROM users ORDER BY name', 'users_export.csv');
  };

  return <button onClick={handleExport}>Export to CSV</button>;
}
```

### Low-Level DuckDB Access

```tsx
import {getDuckDb} from '@sqlrooms/duckdb';

async function executeCustomQuery() {
  const {conn} = await getDuckDb();

  // Execute a query directly
  const result = await conn.query('SELECT COUNT(*) as count FROM users');

  // Access the Arrow table directly
  const count = result.getChildAt(0)?.get(0);
  console.log(`Total users: ${count}`);

  return result;
}
```

## Advanced Features

- **Batch Processing**: Handle large datasets with pagination
- **Arrow Integration**: Work directly with Apache Arrow tables for efficient data processing
- **Schema Management**: Create, inspect, and manage database schemas
- **File Management**: Register and manage files in the DuckDB instance

For more information, visit the SQLRooms documentation.

```

```
