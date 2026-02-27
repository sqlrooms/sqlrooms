DuckDB-centered orchestration layer for SQLRooms multi-database execution.

## Purpose

- Keep DuckDB as the core runtime for SQL execution DAG semantics.
- Register and route connector execution for external engines.
- Aggregate connector catalogs/schemas into one explorer view.
- Materialize non-DuckDB results into core DuckDB with a configurable policy.

## Notes

- This package is intentionally additive and keeps `@sqlrooms/duckdb` APIs intact.
- Default materialization strategy is strict ephemeral attached database mode.
