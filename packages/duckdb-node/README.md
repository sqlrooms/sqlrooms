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
