---
outline: deep
---

# Package Structure

SQLRooms is organized into several packages that work together to provide a complete framework for building analytics applications.

## Core Packages

### [@sqlrooms/project-builder](./api/project-builder/index.md)

Core framework package that provides the foundation for building analytics applications:

- Project state management
- Panel system integration
- DuckDB integration
- Built-in UI components

### [@sqlrooms/project-config](./api/project-config/index.md)

Configuration and type definitions:

- Base project configuration schemas
- Zod schema definitions
- TypeScript types and interfaces
- Constants and utilities

### [@sqlrooms/layout](./api/layout/index.md)

Layout system and panel management:

- Flexible panel layouts
- Sidebar and main view management
- Panel drag and drop
- Layout persistence

### [@sqlrooms/ui](./api/ui/index.md)

Shared UI components and styling:

- Tailwind preset configuration
- Common UI components
- Theme management
- Icons and assets

## Feature Packages

### [@sqlrooms/data-table](./api/data-table/index.md)

Interactive data grid component:

- SQL query result visualization
- Column sorting and filtering
- Row selection and pagination
- Custom cell renderers

### [@sqlrooms/duckdb](./api/duckdb/index.md)

DuckDB integration and utilities:

- DuckDB-WASM instance management
- Query execution
- Data source connections
- Type-safe query results

### [@sqlrooms/dropzone](./api/dropzone/index.md)

File upload and drag-and-drop functionality:

- File upload handling
- Drag and drop zones
- File type validation
- Upload progress tracking

### [@sqlrooms/s3-browser](./api/s3-browser/index.md)

S3-compatible storage browser:

- File browsing interface
- File upload and download
- Directory management
- S3 bucket integration

### [@sqlrooms/sql-editor](./api/sql-editor/index.md)

SQL query editor with advanced features:

- Syntax highlighting
- Auto-completion
- Query history
- Result visualization
