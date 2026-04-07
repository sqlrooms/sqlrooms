# SQLRooms

SQLRooms is a pnpm monorepo of TypeScript packages for building browser-based analytics apps powered by DuckDB.

## Requirements

- Node.js `>=22`
- Package manager: `pnpm`

## Key Commands

| Command          | Purpose                      |
| ---------------- | ---------------------------- |
| `pnpm install`   | Install all dependencies     |
| `pnpm build`     | Build all packages via Turbo |
| `pnpm test`      | Run Jest tests               |
| `pnpm typecheck` | TypeScript type checking     |
| `pnpm lint`      | ESLint                       |
| `pnpm format`    | Prettier                     |
| `pnpm docs:dev`  | Local docs with hot reload   |

## Gotchas

- **Always run `pnpm build` first.** Example apps depend on built `@sqlrooms/*` packages via `workspace:*` links and will not work otherwise.
- **To run an example:** `pnpm dev <name>-example` (<name> is the example/<name> directory name, Vite defaults to port 5173+)
- **`pnpm dev` at the root** watches packages for rebuilds — it does NOT start an app. You still need `pnpm dev` inside an example directory.
- **Lint baseline:** warnings only; 0 errors is the expected state.
- **AI examples** (e.g. `examples/ai`) require `OPENAI_API_KEY`. Core examples (`minimal`, `query`) do not.
- When using Zustand/room-store selectors in React, do not create derived arrays/objects/functions inside the selector (for example `state.items.filter(...)`). That returns a new reference on every read and can trigger `useSyncExternalStore` snapshot loops (`The result of getSnapshot should be cached`) and max update depth errors. Select stable raw state first, then derive with `React.useMemo` in the component.

## Further Reading

Load these only when you need them:

- [Architecture & core concepts](contributing/architecture.md)
- [State patterns (produce, selectors, lifecycle)](contributing/patterns.md)
- [Typescript and React guidelines](contributing/typescript.md)
- [Adding features (packages, visualizations, schema)](contributing/adding-features.md)
- [Troubleshooting](contributing/troubleshooting.md)
- [Python workspace](contributing/python.md)
- [Cursor Cloud setup](contributing/cursor-cloud.md)
- [Contributing guidelines](CONTRIBUTING.md) _(human contributor process: PRs, code of conduct)_
