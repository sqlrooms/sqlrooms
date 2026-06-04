# Cursor Cloud

> Load this file only when working on a Cursor Cloud environment.

## Environment

- Node.js >=22 and pnpm are provided via nvm (pre-installed; see `package.json#engines` and `package.json#packageManager` for exact versions)
- The update script runs `pnpm install` and `pnpm build` on startup — all `@sqlrooms/*` packages will be built and ready

## Running Example Apps

```bash
cd examples/<name> && pnpm dev
```

After making changes to any package source, run `pnpm build` from the repo root before re-running an example.

- `minimal`: lightweight hello-world app
- `query`: full SQL workbench with Monaco editor and data table
- Vite dev servers default to ports 5173+; use `--port` and `--host` flags if needed

## Additional Build Commands

```bash
pnpm build:examples   # build all example apps
pnpm build:all        # build all packages and examples
```

## Gotchas

- No Docker, databases, or external services required — DuckDB runs in-browser via WASM
- The `arrow2csv` bin warnings during `pnpm install` are benign and can be ignored
- AI examples (e.g. `examples/ai`) require an `OPENAI_API_KEY` environment variable at runtime
