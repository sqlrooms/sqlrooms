# AGENTS Usage Guide

This repository is a monorepo managed with pnpm and Turbo. The top-level directories are:

- `packages/` – individual packages that make up the SQLRooms framework
- `examples/` – runnable sample applications
- `docs/` – VitePress documentation source and generated API docs

Each package under `packages/` contains its own `README.md` and `tsconfig.json` for TypeScript configuration.

## Key scripts

The root `package.json` exposes several important scripts:

- `pnpm build` – builds all packages via Turbo
- `pnpm test` – runs Jest tests across packages
- `pnpm lint` – checks code with ESLint
- `pnpm format` – formats files using Prettier
- `pnpm docs:dev` – starts local documentation with hot reload
- `pnpm docs:build` – builds the documentation site
- `pnpm docs:preview` – previews the built docs

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
