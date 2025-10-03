A central configuration and type definitions package that maintains base DuckDB configuration schemas and Zod schema definitions for SQLRooms. It provides TypeScript types and interfaces along with essential constants and utilities used for managing DuckDB state.

## Features

- 📝 **DuckDB Configuration**: Define and manage room DuckDB configuration schemas.
- 🔍 **Type Safety**: Strong TypeScript typing for DuckDB configuration objects.
- ✅ **Validation**: Zod schemas for runtime validation of DuckDB configurations.

## Installation

```bash
npm install @sqlrooms/duckdb-config
# or
yarn add @sqlrooms/duckdb-config
```

## Basic Usage

### Working with DuckDB Configuration

```tsx
import {
  DuckDbSliceConfig,
  createDefaultDuckDbConfig,
} from '@sqlrooms/duckdb-config';

// Create a new DuckDB configuration
const duckDbConfig: DuckDbSliceConfig = createDefaultDuckDbConfig();

// This is then used as part of a bigger room configuration.
// The `RoomConfig` for a room is typically a composition of slice configurations.
// For example:
//
// import {SqlEditorSliceConfig} from '@sqlrooms/sql-editor-config';
//
// type RoomConfig = DuckDbSliceConfig & SqlEditorSliceConfig;
```

## Advanced Features

- **Schema Extensions**: Extend base schemas for custom room types
- **Configuration Validation**: Validate configurations at runtime
- **Serialization**: Convert configurations to/from JSON for storage

For more information, visit the SQLRooms documentation.

```

```
