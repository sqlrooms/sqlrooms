# SQLRooms Python workspace

Use `uv` from `python/`. The maintained distributions are `sqlrooms` (CLI, UI,
ASGI DuckDB runtime and agent connector) and the independent `sqlrooms-rag`.
The standalone `sqlrooms-server` distribution is retired from source/builds.

```sh
uv sync --package sqlrooms
uv run --package sqlrooms sqlrooms ./workspace.duckdb
uv run --package sqlrooms sqlrooms server --db-path ./workspace.duckdb --port 4000
uv run --package sqlrooms pytest sqlrooms/tests
```

Build bundled assets from the repository root with
`pnpm --filter sqlrooms-python build:ui`, then `uv build --package sqlrooms`
from this directory. Version and publication commands have one runtime artifact
owner (`pnpm cli:version`, `pnpm cli:publish:dry`). Publication requires a separate
explicit release operation. `sqlrooms-rag` remains independently versioned.

See [runtime documentation](sqlrooms/README.md),
[migration](sqlrooms/MIGRATION.md) and [authentication](sqlrooms/AUTHENTICATION.md).
