Node.js DuckDB connector for SQLRooms, based on [@duckdb/node-api](https://duckdb.org/docs/stable/clients/node_neo/overview).

## Installation

```bash
pnpm add @sqlrooms/duckdb-node
```

## Usage

```typescript
import {createNodeDuckDbConnector} from '@sqlrooms/duckdb-node';

// Create connector
const connector = createNodeDuckDbConnector({
  dbPath: ':memory:',
  initializationQuery: 'INSTALL json; LOAD json;',
});

// Initialize
await connector.initialize();

// Execute queries
await connector.execute('CREATE TABLE users (id INTEGER, name VARCHAR)');

// Query with Arrow result
const table = await connector.query('SELECT * FROM users');
console.log(table.numRows);

// Query with JSON result
const users = await connector.queryJson('SELECT * FROM users');
for (const user of users) {
  console.log(user);
}

// Clean up
await connector.destroy();
```

## Arrow result types

The connector installs and loads DuckDB's `nanoarrow` community extension
during initialization, then uses DuckDB's own Arrow IPC conversion for query
results. Initialization fails if the extension cannot be installed or loaded.
CI and other restricted-network environments should make the extension
available in DuckDB's extension cache before creating the connector.

Returned Arrow values follow DuckDB's declared types instead of inferred
JavaScript types. For example, `BIGINT` values are Arrow `Int64` values exposed
as JavaScript `bigint`, `DATE` remains `Date32`, and `BLOB` remains `Binary`.
Callers that serialize query results must handle values such as `bigint`
explicitly.

## API

### `createNodeDuckDbConnector(options?)`

Creates a new Node.js DuckDB connector.

**Options:**

- `dbPath` - Path to database file or `:memory:` (default: `:memory:`)
- `initializationQuery` - SQL to run after initialization
- `config` - DuckDB configuration options

**Returns:** `NodeDuckDbConnector`

### `NodeDuckDbConnector`

- `initialize()` - Initialize the connector
- `destroy()` - Clean up resources
- `execute(sql, options?)` - Execute SQL without returning results
- `query(sql, options?)` - Execute SQL and return Arrow table
- `queryJson(sql, options?)` - Execute SQL and return JSON objects
- `getInstance()` - Get underlying DuckDB instance
- `getConnection()` - Get underlying DuckDB connection
