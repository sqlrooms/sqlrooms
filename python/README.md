# Python workspace (uv)

This repo’s Python packages live under `python/` and are managed as a **uv workspace**.

## Workspace root

The workspace is defined in `python/pyproject.toml`:

- Workspace members:
  - `python/sqlrooms-cli` (dist: `sqlrooms`)
  - `python/sqlrooms-server` (dist: `sqlrooms-server`)

Because `sqlrooms` and `sqlrooms-server` share the `sqlrooms.*` namespace (PEP 420), **you should use uv from within the workspace** so it resolves local members correctly.

## Setup

From `python/`:

```bash
cd python
uv sync
```

Or from a member directory:

```bash
cd python/sqlrooms-cli
uv sync
```

## Running the CLI (default UI)

```bash
cd python/sqlrooms-cli
uv run sqlrooms :memory:
```

## Running the server-only backend

```bash
cd python/sqlrooms-server
uv run sqlrooms-server --db-path :memory: --port 4000
```

## How local member resolution works

When a workspace member depends on another member (e.g. `sqlrooms` depends on `sqlrooms-server`), uv needs an explicit mapping in the depending package’s `pyproject.toml`:

```toml
[tool.uv.sources]
sqlrooms-server = { workspace = true }
```

If you see an error like:

> `sqlrooms-server` is included as a workspace member, but is missing an entry in `tool.uv.sources`

add the mapping above to the package that declares the dependency.

## UI bundle in `sqlrooms-cli`

The Python server serves a bundled static UI from:

- `python/sqlrooms-cli/sqlrooms/web/static/`

Build it from the repo root:

```bash
pnpm --filter sqlrooms-cli-app build
```


