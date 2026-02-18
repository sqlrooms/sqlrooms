# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

SQLRooms is a comprehensive framework for building browser-based data analytics applications powered by DuckDB. The repository is structured as a **pnpm monorepo** with 42+ TypeScript packages and a Python workspace for server components.

## Development Commands

### Build & Development
```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Build specific filter (packages only)
pnpm build --filter=@sqlrooms/*

# Development mode with hot reload
pnpm dev

# Clean all build artifacts
pnpm clean
```

### Testing & Quality
```bash
# Run tests
pnpm test

# Watch mode for tests
pnpm test:watch

# Type checking
pnpm typecheck

# Linting
pnpm lint

# Format code
pnpm format
```

### Documentation
```bash
# Develop docs locally (runs TypeDoc + VitePress)
pnpm docs:dev

# Build documentation
pnpm docs:build

# Preview built docs
pnpm docs:preview
```

### Publishing (Maintainers)
```bash
# Version with conventional commits
pnpm version-auto

# Publish (dry run first)
pnpm publish-dry-run
pnpm publish-release
```

### Python Workspace
```bash
# From python/ directory
cd python
uv sync

# Run CLI
cd python/sqlrooms-cli
uv run sqlrooms :memory:

# Run server
cd python/sqlrooms-server
uv run sqlrooms-server --db-path :memory: --port 4000
```

## Architecture Overview

### Core Concepts

#### 1. Slices - Composable State Units
The entire architecture is built on **slices**: self-contained units combining state, actions, and lifecycle hooks.

- Each slice implements `SliceFunctions` with optional `initialize()` and `destroy()` lifecycle methods
- Created via `createSlice()` wrapper using Zustand's `StateCreator`
- Combine into one store via spread: `{...createRoomShellSlice(), ...createDuckDbSlice()}`
- Automatically initialized/destroyed via `room.initialize()` orchestration

Common slices:
- `RoomShellSliceState`: Base layer with config, file management, data sources
- `DuckDbSliceState`: Database operations (tables, queries, schemas)
- `LayoutSliceState`: Panel management and mosaic layout
- `SqlEditorSliceState`: SQL editor state and query results
- `AiSliceState`: AI chat sessions and tool execution

#### 2. Room - Complete Workspace
A **Room** is a composable data exploration workspace defined by combining slices in `createRoomStore()`.

Pattern:
```typescript
export type RoomState = RoomShellSliceState & DuckDbSliceState & CustomSliceState;
export const {roomStore, useRoomStore} = createRoomStore<RoomState>(stateCreator);
```

#### 3. State Management: Zustand + Immer
- **Zustand**: Lightweight state management with devtools middleware
- **Immer**: Immutable updates via mutable draft syntax in `produce()`
- **Persistence**: State serialized via Zod schemas with `persistSliceConfigs()`

State updates pattern:
```typescript
set((state) => produce(state, (draft) => {
  draft.db.tables = newTables;
}))
```

### DuckDB Integration

Three-layer architecture:

1. **`duckdb-core`**: Platform-agnostic types (`DuckDbConnector`, `QueryHandle`, Arrow utilities)
2. **`duckdb`**: Web implementations (WASM connector, WebSocket connector, React hooks)
3. **`duckdb-node`**: Node.js support for SSR/backend

Key hooks:
- `useSql()`: Execute SQL queries with automatic re-runs on state changes
- `useDuckDb()`: Access DuckDB connector directly
- `useDuckDbQuery()`: Lower-level query execution

Data flow:
```
RoomShell Config (dataSources)
  → RoomShellSlice loads files/URLs
  → db.addTable(tableName, arrowTable)
  → DuckDB connector executes CREATE/INSERT
  → Cache updated, UI re-renders
```

### Package Organization

#### Core Packages (Essential)
- `room-store`: Zustand + Immer foundation, `createRoomStore`, persistence
- `room-config`: Zod schemas for configs and data sources
- `room-shell`: Main UI entry, panel management, RoomShell component
- `duckdb-core`: Low-level DuckDB abstraction
- `duckdb`: High-level DuckDB integration with React hooks
- `layout` + `layout-config`: Mosaic-based panel layout system
- `ui`: Radix UI component library with Tailwind presets
- `data-table`: Virtualized tables for Arrow data

#### Feature Packages (Optional)
- `sql-editor`: Monaco-based SQL editor with query execution
- `kepler`: Kepler.gl geospatial visualization
- `mosaic`: Observable Mosaic interactive charts
- `vega`: Vega-Lite specification editor and rendering
- `ai`, `ai-core`, `ai-config`, `ai-settings`, `ai-rag`: AI agents with tool execution
- `canvas`, `cosmos`, `discuss`, `recharts`: Additional visualizations
- `motherduck`, `s3-browser`: External data source integrations

#### Utility Packages
- `utils`: File conversion, Arrow operations, column naming
- `schema-tree`: Database schema hierarchy
- `crdt`: Collaborative features (experimental)
- `preset-*`: Build configs (ESLint, Jest, TypeScript, TypeDoc)

### Data Sources

Three types defined in `room-config`:
```typescript
// File upload
{type: 'file', fileName: 'data.parquet', tableName: 'data'}

// Direct URL
{type: 'url', url: 'https://...data.csv', tableName: 'data'}

// SQL query result
{type: 'sql', query: 'SELECT * FROM other_table', tableName: 'derived'}
```

### Panel System

Panels are React components with access to the room store:
```typescript
layout: {
  panels: {
    'sql-editor': {
      title: 'SQL Editor',
      icon: DatabaseIcon,
      component: SqlEditorPanel,
      placement: 'sidebar',  // 'sidebar' | 'main'
    },
  },
  config: {
    nodes: {  // Mosaic tree structure
      direction: 'row',
      first: 'sql-editor',
      second: 'main',
      splitPercentage: 30,
    },
  },
}
```

### AI/Agent Framework

Tools are composable functions for LLM agents:
```typescript
tools: {
  query: {
    name: 'query',
    parameters: z.object({sql: z.string()}),
    execute: async ({sql}) => ({llmResult: {rows: [...]}}),
    component: QueryToolResult,  // UI for result
  },
}
```

Tools have full access to room store via `createDefaultAiTools(store)`.

## Important Patterns

### 1. Always Use Produce for State Updates
```typescript
// Correct
set((state) => produce(state, (draft) => {
  draft.db.tables.push(newTable);
}))

// Incorrect - will not trigger updates
set((state) => {
  state.db.tables.push(newTable);
  return state;
})
```

### 2. Zustand Selectors for Performance
```typescript
// Memoized, efficient
const tables = useRoomStore((state) => state.db.tables);

// Re-renders on any store change
const {db} = useRoomStore();  // Avoid unless necessary
```

### 3. Lifecycle Management
- Slices auto-initialize via `room.initialize()` on mount
- Clean up resources in slice's `destroy()` method
- DuckDB connector auto-created during initialization

### 4. Query Cancellation
QueryHandle supports AbortSignal:
```typescript
const handle = await db.executeSql(query);
handle.cancel();  // Aborts query execution
```

### 5. Schema Validation
All configs use Zod schemas:
```typescript
type MyConfig = z.infer<typeof MyConfigSchema>;
```

## Workspace Structure

```
sqlrooms/
├── packages/           # 42+ TypeScript packages
│   ├── room-store/    # State foundation
│   ├── room-shell/    # Core UI
│   ├── duckdb/        # DuckDB integration
│   ├── sql-editor/    # SQL editor feature
│   └── ...
├── examples/          # 20+ example apps
├── apps/              # Production apps
├── python/            # Python workspace (uv)
│   ├── sqlrooms-cli/
│   ├── sqlrooms-server/
│   └── ...
├── docs/              # VitePress documentation
└── scripts/           # Build utilities
```

## Testing Strategy

- Unit tests: `pnpm test` runs Jest across all packages
- Individual package: `cd packages/duckdb && pnpm test`
- Watch mode for TDD: `pnpm test:watch`

## Common Tasks

### Adding a New Feature Package

1. Create package in `packages/my-feature/`
2. Add to `pnpm-workspace.yaml` (auto-detected via `packages/*`)
3. Create slice: `export const createMyFeatureSlice = () => (set, get, store) => ({...})`
4. Export types: `export type MyFeatureSliceState = {...}`
5. Add TypeDoc config if needed

### Modifying DuckDB Schema

Changes to table structure:
1. Update schema in `duckdb-core/src/types.ts`
2. Modify loader in `room-shell` if data source handling changes
3. Update `db.addTable()` or `db.loadTableSchemas()` in `duckdb` slice

### Adding a New Visualization

1. Create package `packages/my-viz/`
2. Implement slice with viz state
3. Create React components consuming `useRoomStore`
4. Add to example app to demonstrate usage

### Working with Git LFS

Media files in `docs/media/` use Git LFS:
```bash
# Install Git LFS
brew install git-lfs  # macOS

# Initialize in repo
git lfs install

# Pull LFS files
git lfs pull
```

## Dependencies

### Core Runtime Dependencies
- React 18+ (React 19 supported)
- Tailwind CSS 3 (Tailwind 4 experimental)
- Node.js >= 22
- Apache Arrow (bundled with DuckDB packages)
- Zustand (state management)
- Zod (schema validation)

### Key Build Tools
- pnpm: Package manager (workspaces)
- Turbo: Monorepo build orchestration
- TypeScript 5.9.3
- Vite: Dev server and bundling
- ESLint 9: Linting with custom preset
- Jest: Testing framework

### Python Environment
- uv: Python package manager
- Python 3.11+

## Key Technical Insights

1. **Everything is a slice** - wrap new features in slice creator functions
2. **Immer + Zustand** - always use `produce()` for nested state updates
3. **DuckDB is central** - all data flows through the connector (WASM/WebSocket)
4. **Panels are composable** - any React component can be a panel with store access
5. **Configs are validated** - Zod schemas ensure type safety through persistence
6. **Initialization is orchestrated** - `room.initialize()` calls all slice initializers
7. **Arrow is the data format** - browser↔DuckDB uses Apache Arrow serialization
8. **HMR is built-in** - room store preserves state across hot reloads
9. **Query caching** - duplicate queries reuse same QueryHandle
10. **Visualization tools generate SQL** - Kepler/Mosaic/Vega execute SQL under the hood

## Troubleshooting

### Build Issues
- `pnpm clean` removes all build artifacts and cache
- Check `turbo.json` for task dependencies
- Verify `pnpm-lock.yaml` is up to date: `pnpm install`

### Type Errors
- Run `pnpm typecheck` to see all errors across workspace
- Ensure all packages are built: `pnpm build`
- Check TypeScript version (should be 5.9.3)

### DuckDB Connection Issues
- WASM connector requires proper CORS headers for remote files
- WebSocket connector needs server running at specified URL
- Check browser console for initialization errors

### Import Resolution
- Packages must be built before importing: `pnpm build`
- Use workspace protocol in package.json: `"@sqlrooms/ui": "workspace:*"`
- Restart TypeScript server after adding new packages
