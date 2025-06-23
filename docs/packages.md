---
outline: deep
---

## Package Structure

Below is a full breakdown of all **Core**, **Feature**, and **Utility** packages available in SQLRooms.  
Each package can be installed independently via `pnpm add @sqlrooms/<name>` and mixed‑and‑matched to suit your app's needs.

### Core Packages

- **[@sqlrooms/room-shell](/api/room-shell/)** — Central application shell and Zustand‑based state manager with panel system and DuckDB integration.
- **[@sqlrooms/room-store](/api/core/)** — Core state management utilities, RoomStore, and React context providers.
- **[@sqlrooms/duckdb](/api/duckdb/)** — WebAssembly build of DuckDB plus helper hooks for query execution and data import.
- **[@sqlrooms/ui](/api/ui/)** — Tailwind‑powered component library and theme manager used across all other packages.
- **[@sqlrooms/ai](/api/ai/)** — Natural‑language querying and AI‑assisted analytics tools.
- **[@sqlrooms/layout](/api/layout/)** — Panel layout management built on react‑mosaic.

### Feature Packages

- **[@sqlrooms/cosmos](/api/cosmos/)** — High‑performance WebGL graph visualization with Cosmos.
- **[@sqlrooms/data-table](/api/data-table/)** — Interactive data grid for SQL results with sorting and pagination.
- **[@sqlrooms/discuss](/api/discuss/)** — Threaded discussion system with anchor links to data points.
- **[@sqlrooms/dropzone](/api/dropzone/)** — Drag‑and‑drop file uploads with type validation and progress tracking.
- **[@sqlrooms/monaco-editor](/api/monaco-editor/)** — VS Code's Monaco editor with SQL‑aware autocompletion.
- **[@sqlrooms/mosaic](/api/mosaic/)** — Declarative charting powered by UW IDL's Mosaic library.
- **[@sqlrooms/recharts](/api/recharts/)** — Responsive charts via Recharts (line, bar, pie, etc.).
- **[@sqlrooms/s3-browser](/api/s3-browser/)** — S3‑compatible storage browser with uploads and directory management.
- **[@sqlrooms/schema-tree](/api/schema-tree/)** — Interactive database‑schema explorer.
- **[@sqlrooms/sql-editor](/api/sql-editor/)** — SQL editor with history, syntax highlighting, and result docking.
- **[@sqlrooms/vega](/api/vega/)** — Vega‑Lite visualization components for sophisticated interactive charts.

### Utility Packages

- **[@sqlrooms/utils](/api/utils/)** — Shared helper functions for colors, formatting, random IDs, and string utilities.

## Extension Points
