SQLRooms is a local-first, modular analytics workspace built around DuckDB, React, composable UI surfaces, and AI-assisted data exploration. Preserve that direction when making changes.

## Principles

- It’s okay to say “I don’t know.” Prefer honesty over confident guesses.
- Don’t assume the human user is always right. Constructively challenge requests, assumptions, or proposed designs when there may be a better approach.
- When something is ambiguous, make a reasonable assumption and state it clearly. Ask for clarification only when the ambiguity blocks meaningful progress.
- Prefer small, practical, reviewable changes over large speculative rewrites.
- Follow existing patterns unless there is a clear reason to change them.

## SQLRooms Design Philosophy

- Favor modular, composable building blocks over large, hard-coded workflows.
- Core concepts such as data sources, queries, views, maps, dashboards, documents, commands, and AI tools should be designed so they can be combined in different ways.
- Prefer APIs and components that compose naturally across blocks, documents, dashboards, notebooks, maps, queries, and agent tools, rather than APIs that only work for one surface.
- Avoid over-generalizing too early. Prefer concrete primitives that compose well over abstract frameworks that try to anticipate every future use case.
- Preserve SQLRooms’ local-first, portable-workspace model: state, data, UI configuration, and analysis context should remain understandable, inspectable, and portable where practical.
- AI agents should preferably use the same composable primitives as the user interface (e.g. commands), not separate hidden mechanisms.

## Code Philosophy

- Simplicity trumps minor performance gains. Substantial performance improvements can justify added complexity when the trade-off is clear.
- CPU and memory usage both matter. Avoid optimizing one while carelessly harming the other.
- Prefer minimal but deep APIs over wide, shallow APIs, following John Ousterhout’s software design philosophy. The goal is to manage complexity, not merely distribute it.
- Prefer straightforward, maintainable code over clever code.
- Make the smallest change that solves the problem well while preserving the surrounding architecture and design intent.
- Add or update tests when changing behavior or public API, when practical.

## Repository Structure

- `packages/` contains reusable `@sqlrooms/*` packages. Treat public exports here as library APIs: keep them generic, composable, documented, and free of app/example-specific assumptions.
- `examples/` contains small runnable examples and integration testbeds. Prefer clarity and focused demonstrations over abstraction; examples may wire packages together but should avoid becoming new framework layers.
- `apps/` contains real applications built from the packages. App-specific product decisions belong here unless they are clearly reusable across SQLRooms.
- Before moving code from an app or example into `packages/`, check that it is genuinely reusable and has a stable API shape. Avoid pushing one-off product decisions into shared packages too early.

## Code style

- Object-oriented functional programming over classes in JS/TS
- Semantic git messages for commits

## Documentation

- When changing the public API of an `@sqlrooms/*` package, or when adding new public API, update the package’s `README.md`.
- If behavior changes in examples, update the relevant example docs or comments.

## Gotchas

- **Build workspace packages before running examples.** Example apps depend on built `@sqlrooms/*` packages via `workspace:*` links. Run `pnpm build` first, especially after a fresh checkout or after changing package code.
- **To run an example app:** use `pnpm dev <name>-example`, where `<name>` is the `examples/<name>` directory name. Vite defaults to port `5173+`.
- **`pnpm dev` at the repo root does not start an app.** It watches packages for rebuilds. To run an actual app, use the example-specific dev command.

## React and State Management

- When using Zustand or room-store selectors in React, do not create derived arrays, objects, or functions inside the selector.

  Avoid:

  ```ts
  const items = useStore((state) => state.items.filter(...));
  ```

  This returns a new reference on every read and can trigger `useSyncExternalStore` snapshot loops such as:

  ```txt
  The result of getSnapshot should be cached
  ```

  It can also cause maximum update depth errors.

- Prefer selecting stable raw state first, then deriving values with `React.useMemo` inside the component.

  Prefer:

  ```ts
  const items = useStore((state) => state.items);

  const filteredItems = React.useMemo(
    () => items.filter(...),
    [items],
  );
  ```

- Use the room Zustand store when state is app-level, cross-panel, persisted, or needs to coordinate with other room features.
- Use an internal feature-local Zustand store when state is instance-scoped to a component family or compound API.
- Keep React context thin and stable. Context should usually expose an existing hook/store API rather than become the primary state system.

## Component API Patterns

- When adding a grouped UI surface with shared state, prefer a compound component API over repeating the same state prop across multiple sibling components.
- Preferred pattern:
  - export a top-level compound component that provides context, for example `<Feature>` or `<Feature.Root>`
  - expose subcomponents such as `<Feature.Header />`, `<Feature.Rows />`, and `<Feature.StatusBar />`
  - keep lower-level hooks or prop-based primitives available when advanced composition is still valuable
- Keep the context layer thin and stable. Avoid turning a compound provider into a second state system.
- If shared state is more complex than a few props, prefer managing it in a Zustand store rather than in large prop bags or deeply nested local React state.

## Commands and Agent Integration

- Prefer using existing commands, registries, stores, and public APIs before adding new mechanisms.
- When adding commands, scope them to the appropriate surfaces.
- Do not create agent-only command paths when the same capability can be expressed through the existing command or state model.
- Agent actions should be reproducible, inspectable, and visible through the same mechanisms used by the UI where practical.

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
