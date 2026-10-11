# Troubleshooting

> When: encountering build errors, type errors, or DuckDB issues.

## Build Issues

- Run `pnpm clean` to remove all build artifacts and Turbo cache, then `pnpm build`
- Check `turbo.json` for task dependency order if a package isn't building
- If packages seem mismatched after dependency changes: run `pnpm install` to sync the lockfile

## Type Errors

- Run `pnpm typecheck` to see all errors across the full workspace
- Type errors often mean a dependency package hasn't been built yet — run `pnpm build` first
- After adding a new package, restart the TypeScript language server in your editor

## DuckDB Connection Issues

- **WASM connector**: requires proper CORS headers when loading remote files
- **WebSocket connector**: needs the server running at the specified URL before the browser connects
- Check the browser console for initialization errors — DuckDB WASM surfaces errors there

## Import Resolution

- Packages must be built before importing: `pnpm build`
- Use the workspace protocol in `package.json`: `"@sqlrooms/ui": "workspace:*"`
- After adding a new `@sqlrooms/*` package to an app's dependencies, rebuild: `pnpm build`
