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
