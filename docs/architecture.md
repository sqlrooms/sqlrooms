# Modular Architecture

SQLRooms is designed with a modular architecture that allows developers to pick and choose exactly the functionality they need for their data analytics applications. This approach enables you to build custom solutions tailored to your specific requirements.

![SQLRooms Architecture](/media/overview/architecture.svg)

## Core Principles

The SQLRooms architecture follows these key principles:

1. **Modularity**: Each package has a specific, focused purpose
2. **Composability**: Packages can be combined in various ways to create custom applications
3. **Minimal Dependencies**: Packages only depend on what they absolutely need
4. **Consistent API Design**: All packages follow similar patterns for ease of use
5. [**Slice-Based State Management**](/state-management): State management uses a composable slice pattern that allows applications to combine functionality from different modules

## Core Components

### RoomStore

The central state management system built on Zustand handles:

- Room configuration and persistence
- Data source management
- DuckDB integration
- Type-safe state management

The RoomStore can be extended with custom configuration and functionality specific to your needs.

### RoomShell

Provides the application shell with:

- Configurable and pluggable views
- Flexible panel layouts
- Sidebar and main view management

### Built-in Views

Ready-to-use components accelerate development:

- DataTable View for displaying and interacting with query results
- S3 Browser for managing data sources and importing data
- SQL Query Editor with syntax highlighting

## Package Structure

Below is a full breakdown of all **Core**, **Feature**, and **Utility** packages available in SQLRooms.  
Each package can be installed independently via `pnpm add @sqlrooms/<name>` and mixed‑and‑matched to suit your app’s needs.

### Core Packages

- **[@sqlrooms/room-shell](/api/room-shell/)** — Central application shell and Zustand‑based state manager with panel system and DuckDB integration.
- **[@sqlrooms/room-config](/api/room-config/)** — Shared configuration schemas and TypeScript types powered by Zod.
- **[@sqlrooms/duckdb](/api/duckdb/)** — WebAssembly build of DuckDB plus helper hooks for query execution and data import.
- **[@sqlrooms/ui](/api/ui/)** — Tailwind‑powered component library and theme manager used across all other packages.

### Feature Packages

- **[@sqlrooms/ai](/api/ai/)** — Natural‑language querying and AI‑assisted analytics tools.
- **[@sqlrooms/cosmos](/api/cosmos/)** — High‑performance WebGL graph visualization with Cosmos.
- **[@sqlrooms/data-table](/api/data-table/)** — Interactive data grid for SQL results with sorting and pagination.
- **[@sqlrooms/discuss](/api/discuss/)** — Threaded discussion system with anchor links to data points.
- **[@sqlrooms/dropzone](/api/dropzone/)** — Drag‑and‑drop file uploads with type validation and progress tracking.
- **[@sqlrooms/layout](/api/layout/)** — Panel layout management built on react‑mosaic.
- **[@sqlrooms/monaco-editor](/api/monaco-editor/)** — VS Code’s Monaco editor with SQL‑aware autocompletion.
- **[@sqlrooms/mosaic](/api/mosaic/)** — Declarative charting powered by UW IDL’s Mosaic library.
- **[@sqlrooms/recharts](/api/recharts/)** — Responsive charts via Recharts (line, bar, pie, etc.).
- **[@sqlrooms/s3-browser](/api/s3-browser/)** — S3‑compatible storage browser with uploads and directory management.
- **[@sqlrooms/schema-tree](/api/schema-tree/)** — Interactive database‑schema explorer.
- **[@sqlrooms/sql-editor](/api/sql-editor/)** — SQL editor with history, syntax highlighting, and result docking.
- **[@sqlrooms/vega](/api/vega/)** — Vega‑Lite visualization components for sophisticated interactive charts.

### Utility Packages

- **[@sqlrooms/utils](/api/utils/)** — Shared helper functions for colors, formatting, random IDs, and string utilities.

## Extension Points

The framework is designed to be highly extensible through:

1. **Extended RoomStore**

   - Custom room configuration using Zod schemas
   - Additional state management
   - Integration with other services

2. **Custom Views and Panels**
   - Create specialized views for specific use cases
   - Configure panel layouts and behavior
   - Integrate with existing panel management

## Runtime Anatomy

1. Data sources (CSV, Parquet) are loaded through the dropzone, the S3 browser or custom import methods
2. DuckDB processes queries locally in the browser
3. Results are displayed in the DataTable view or custom visualizations
4. Room state can be saved and loaded for persistence

This extensibility allows you to customize the behavior of each slice to meet your specific requirements.

# Conclusion

SQLRooms' modular architecture gives you the flexibility to build exactly the data analytics application you need. By combining different packages and slices, you can create anything from simple data explorers to complex AI-powered analytics dashboards, all running entirely in the browser.

The [slice-based state management](/state-management) makes it easy to pick and choose the functionality you need while maintaining a clean and organized codebase. This approach allows for maximum flexibility and extensibility, enabling you to create custom solutions tailored to your specific requirements.

[← Back to Overview](/overview)
