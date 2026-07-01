# Table Reference Type Boundary Inventory

Inventory captured for the staged cleanup in the Obsidian plan `SQLRooms Table Reference Type Boundary Cleanup Plan`.

## Current Owners

- `packages/duckdb-core/src/duckdb-utils.ts` owns `QualifiedTableName`, quote-aware identifier parsing, SQL quoting, and table reference resolution.
- `packages/mosaic/src/mosaicTableReference.ts` owns Mosaic-specific conversions. Mosaic SQL generation intentionally omits the catalog/database, while persisted identities and chart specs still flow through string-shaped config fields.

## Saved State Shapes

- Mosaic dashboards use string-shaped `selectedTable` and `lastSelectedTable` fields.
- Worksheet, dashboard, and data-table block commands accept `tableName: string`.
- Deck map datasets use `source.tableName?: string` and sometimes pair it with a SQL query.
- AI tool inputs and durable context still expose compatibility names such as `tableName`.

## Highest-Risk Execution Boundaries

- Generic `quoteTableReference(...)` callers that build direct SQL.
- Deck map fit and dashboard source rewriting.
- Pivot SQL query construction.
- Cell SQL helpers and execution paths.
- CLI app schema/read queries.
- Mosaic data-table explorer and chart query clients.

## Rehydration Boundaries

- JSON/Zod dashboard and panel schemas.
- Worksheet command schemas.
- AI tool schemas and outputs.
- App artifact context.
- `db.findTable(...)`, `useDataTable(...)`, and related lookup helpers.

Legacy bare table names remain accepted only at explicit resolution boundaries. New write paths should choose a named table-reference helper before persisting or executing.

## Compatibility And Migration Policy

Saved workspace state continues to resolve table references lazily at runtime.
Dashboard selected tables, dashboard panel dataset sources, worksheet chart
blocks, data-table blocks, and map blocks may still contain old bare names,
canonical identities such as `"main"."events"`, fully qualified default-database
identities such as `"memory"."main"."events"`, or attached-database identities
such as `"remote"."main"."events"`.

This is intentional for now: runtime resolution can validate old references
against the currently loaded catalog without silently rewriting portable user
state. New write paths should store canonical `TableIdentity` values produced by
`getTableIdentity(...)` after resolving a concrete table. Direct SQL builders
should use `getRawSqlTableReference(...)` or an explicit legacy/user-input
quoting boundary.

Do not add eager workspace migration for table-reference strings until there are
fixture-backed rules for default-database portability and attached-database
identity preservation.
