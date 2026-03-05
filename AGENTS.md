# AGENTS Usage Guide

This repository is a monorepo managed with pnpm and Turbo. The top-level directories are:

- `packages/` – individual packages that make up the SQLRooms framework
- `examples/` – runnable sample applications
- `docs/` – VitePress documentation source and generated API docs

Each package under `packages/` contains its own `README.md` and `tsconfig.json` for TypeScript configuration.

## Key scripts

The root `package.json` exposes several important scripts:

- `pnpm build` – builds all packages via Turbo
- `pnpm typecheck` - runs typescript --noEmit
- `pnpm test` – runs Jest tests across packages
- `pnpm lint` – checks code with ESLint
- `pnpm format` – formats files using Prettier
- `pnpm docs:dev` – starts local documentation with hot reload
- `pnpm docs:build` – builds the documentation site

Node.js version **>=22** is required.

## Running example apps

To run an example application:

```bash
pnpm build          # build all sqlrooms packages
pnpm build:examples # build all examples
pnpm build:all      # build all sqlrooms packages and examples
cd examples/ai      # or another example directory
pnpm dev            # start the example
```

## Contributing

When adding features, update the relevant documentation and verify that example applications work with your changes. See `CONTRIBUTING.md` for full guidelines.

## Cursor Cloud specific instructions

### Environment

- Node.js >= 22 and pnpm 10.29.3 are provided via nvm (pre-installed).
- The update script runs `pnpm install` and `pnpm build` on startup. All `@sqlrooms/*` packages will be built and ready.

### Running services

- **Example apps**: `cd examples/<name> && pnpm dev`. The `minimal` example is a lightweight "hello-world"; the `query` example provides a full SQL workbench with Monaco editor and data table.
- Example Vite dev servers default to ports 5173+. Use `--port` and `--host` flags if needed.
- No Docker, databases, or external services are required for core development. DuckDB runs in-browser via WASM.

### Gotchas

- `pnpm build` must complete before any example app will work, since examples depend on built `@sqlrooms/*` packages via `workspace:*` links.
- The `arrow2csv` bin warnings during `pnpm install` are benign and can be ignored.
- Tests only exist in 5 packages (`utils`, `duckdb`, `duckdb-core`, `duckdb-node`, `crdt`). Running `pnpm test` is fast (~10s).
- Lint produces warnings only (no errors) in the current codebase; 0 errors is the expected baseline.
- AI-related examples (e.g. `examples/ai`) require an `OPENAI_API_KEY` environment variable at runtime; core examples like `minimal` and `query` do not need any API keys.
- When using Zustand/room-store selectors in React, do not create derived arrays/objects/functions inside the selector (for example `state.items.filter(...)`). That returns a new reference on every read and can trigger `useSyncExternalStore` snapshot loops (`The result of getSnapshot should be cached`) and max update depth errors. Select stable raw state first, then derive with `React.useMemo` in the component.
