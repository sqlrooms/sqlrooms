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

## Table Interop

- SQLRooms generally defaults to Apache Arrow for query/data results, including
  the DuckDB integration and many downstream package APIs.
- Mosaic is the main internal exception: its native client/table runtime is
  Flechette/Mosaic-native, but public SQLRooms hooks should generally expose
  Apache Arrow.
- deck is not unique in using Arrow, but its GeoArrow integration is a
  particularly Arrow-sensitive consumer because it relies on Arrow
  `Table` / `Vector` behavior and the current `@geoarrow/deck.gl-layers`
  contract.
- **Canonical shared representation:** Arrow IPC bytes, not eagerly materialized Flechette + Arrow tables.
- **Default API rule:** app code and examples should pass tables through SQLRooms packages directly. Do not add ad hoc `tableToIPC(...)`, `tableFromIPC(...)`, or other third-party conversion glue in examples unless there is no SQLRooms-owned path available.
- Table interop helpers are Mosaic-internal. Use them inside `@sqlrooms/mosaic`
  when adapting Arrow query results into Mosaic-native tables and when exposing
  Arrow results from Mosaic public hooks.
- `@sqlrooms/deck` should stay Arrow-native and should not depend on Mosaic or
  Flechette table interop.
- **Why this exists:** without the interop contract, the Mosaic -> SQLRooms Arrow-native path, especially Mosaic -> deck, can do a wasteful Arrow -> Flechette -> Arrow roundtrip.
- **Memory goal:** avoid eager double materialization. Arrow should be decoded lazily and memoized only if an Arrow-native consumer actually needs it.

## Component API Patterns

- When adding a new grouped UI surface with shared state, prefer a compound component API over repeating the same state prop across multiple siblings.
- Preferred pattern:
  - export a top-level compound component that provides context, for example `<Feature>` or `<Feature.Root>`
  - expose subcomponents like `<Feature.Header />`, `<Feature.Rows />`, `<Feature.StatusBar />`
  - keep the lower-level hook or prop-based primitives available underneath when advanced composition is still valuable
- For profiler-style features, prefer the compound form for docs, examples, and new call sites:
  - use `<MosaicProfiler ...>` or `<MosaicProfiler.Root profiler={...}>`
  - then render `<MosaicProfiler.Header />`, `<MosaicProfiler.Rows />`, and related subcomponents inside
- Keep the context layer thin and stable. Avoid turning a compound provider into a second state system; it should usually wrap an existing hook/store API rather than replace it.
- If the shared state is more complex than a few props, prefer managing it in a Zustand store rather than in large prop bags or deeply nested local React state.
- State ownership guidance:
  - use the room Zustand store when the state is app-level, cross-panel, or needs to coordinate with other room features
  - use an internal feature-local Zustand store when the state is instance-scoped to a component family or compound API
  - keep the compound context/provider as a thin access layer over that state, not as the primary place where complex state is modeled

## Documentation

When changing the public API of an @sqlrooms/\* package or adding new public API, make sure to update the package's README.md accordingly.

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
