---
outline: deep
---

## Package Structure

Below is a full breakdown of all **Core**, **Feature**, **Experimental**, and **Utility** packages available in SQLRooms.
Each package can be installed independently via `pnpm add @sqlrooms/<name>` and mixed‑and‑matched to suit your app's needs.

### Core Packages

- **[@sqlrooms/artifacts](/api/artifacts/)** — Artifact registry, workspace tab helpers, and layout integration for dashboards, notebooks, documents, canvases, pivots, and apps.
- **[@sqlrooms/blocks](/api/blocks/)** — Shared block contracts and vocabulary for composable SQLRooms blocks and block containers.
- **[@sqlrooms/room-config](/api/room-config/)** — Zod schemas and types for persisted room configuration.
- **[@sqlrooms/room-shell](/api/room-shell/)** — Central application shell and Zustand‑based state manager with panel system and DuckDB integration.
- **[@sqlrooms/room-store](/api/core/)** — Core state management utilities, RoomStore, and React context providers.
- **[@sqlrooms/duckdb](/api/duckdb/)** — WebAssembly build of DuckDB plus helper hooks for query execution and data import.
- **[@sqlrooms/duckdb-core](/api/duckdb-core/)** — Shared DuckDB connector contracts and core query/import utilities.
- **[@sqlrooms/duckdb-node](/api/duckdb-node/)** — Node.js DuckDB connector for server-side SQLRooms runtimes.
- **[@sqlrooms/db](/api/db/)** — DuckDB-centered orchestration layer for multi-database execution.
- **[@sqlrooms/db-settings](/api/db-settings/)** — Database connection settings state and UI components.
- **[@sqlrooms/ui](/api/ui/)** — Tailwind‑powered component library and theme manager used across all other packages.
- **[@sqlrooms/ai](/api/ai/)** — Natural‑language querying and AI‑assisted analytics tools.
- **[@sqlrooms/ai-config](/api/ai-config/)** — Zod schemas and defaults for persisted AI slice configuration.
- **[@sqlrooms/ai-core](/api/ai-core/)** — Lower-level AI slice, chat UI primitives, and tool-streaming utilities.
- **[@sqlrooms/ai-settings](/api/ai-settings/)** — AI provider/model settings state and UI components.
- **[@sqlrooms/layout](/api/layout/)** — Panel layout management built on react‑mosaic.
- **[@sqlrooms/layout-config](/api/layout-config/)** — Zod schemas and types for persisted layout configuration.

### Feature Packages

- **[@sqlrooms/cells](/api/cells/)** — Shared cells model and UI primitives used by notebook and canvas views.
- **[@sqlrooms/codemirror](/api/codemirror/)** — CodeMirror 6 editor components with SQLRooms theme integration and JSON/JavaScript editing helpers.
- **[@sqlrooms/color-scales](/api/color-scales/)** — Color-scale config, validation, legend models, and React legend components.
- **[@sqlrooms/cosmos](/api/cosmos/)** — High‑performance WebGL graph visualization with Cosmos.
- **[@sqlrooms/data-table](/api/data-table/)** — Interactive data grid for SQL results with sorting and pagination.
- **[@sqlrooms/deck](/api/deck/)** — Deck.gl map integration with JSON-driven map specs and DuckDB/Arrow dataset binding.
- **[@sqlrooms/documents](/api/documents/)** — Markdown document artifacts, structured BlockDocument/Worksheet surfaces, rich editors, document assets, and document CRDT sync.
- **[@sqlrooms/dropzone](/api/dropzone/)** — Drag‑and‑drop file uploads with type validation and progress tracking.
- **[@sqlrooms/kepler](/api/kepler/)** — Kepler.gl integration for map-first SQLRooms analytics experiences.
- **[@sqlrooms/kepler-config](/api/kepler-config/)** — Zod schemas for persisted Kepler slice state.
- **[@sqlrooms/monaco-editor](/api/monaco-editor/)** — VS Code's Monaco editor with SQL‑aware autocompletion.
- **[@sqlrooms/mosaic](/api/mosaic/)** — Declarative charting powered by UW IDL's Mosaic library.
- **[@sqlrooms/motherduck](/api/motherduck/)** — MotherDuck connector using the WASM client
- **[@sqlrooms/recharts](/api/recharts/)** — Responsive charts via Recharts (line, bar, pie, etc.).
- **[@sqlrooms/s3-browser](/api/s3-browser/)** — S3‑compatible storage browser with uploads and directory management.
- **[@sqlrooms/s3-browser-config](/api/s3-browser-config/)** — Zod schemas for persisted S3 browser configuration.
- **[@sqlrooms/schema-tree](/api/schema-tree/)** — Interactive database‑schema explorer.
- **[@sqlrooms/sql-editor](/api/sql-editor/)** — SQL editor with history, syntax highlighting, and result docking.
- **[@sqlrooms/sql-editor-config](/api/sql-editor-config/)** — Zod schemas and defaults for persisted SQL editor state.
- **[@sqlrooms/vega](/api/vega/)** — Vega‑Lite visualization components for sophisticated interactive charts.

### Experimental Packages

- **[@sqlrooms/ai-rag](/api/ai-rag/)** — Retrieval-augmented generation slice for semantic search over DuckDB-backed embeddings.
- **[@sqlrooms/canvas](/api/canvas/)** — React Flow-based artifact canvas for SQL, Vega, and dataflow node DAGs.
- **[@sqlrooms/crdt](/api/crdt/)** — Loro-backed CRDT slice, persistence, and sync helpers.
- **[@sqlrooms/discuss](/api/discuss/)** — Threaded discussion system with anchor links to data points.
- **[@sqlrooms/notebook](/api/notebook/)** — Artifact-scoped notebook UI and state slice for SQL, text, Markdown, Vega, and input cells.
- **[@sqlrooms/pivot](/api/pivot/)** — Slice-driven pivot table UI backed by DuckDB SQL and Vega-Lite charts.
- **[@sqlrooms/webcontainer](/api/webcontainer/)** — WebContainer state slice and runtime helpers for app-building workflows.

### Utility Packages

- **[@sqlrooms/utils](/api/utils/)** — Shared helper functions for colors, formatting, random IDs, and string utilities.

## Extension Points
