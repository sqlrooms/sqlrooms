---
name: sqlrooms
description: Create and edit SQLRooms documents, charts, and maps through a connected SQLRooms MCP workspace. Use for workspace authoring, not repository code changes.
metadata:
  version: '4'
---

Use the SQLRooms MCP tools to operate the live workspace. SQLRooms owns data and
artifact state; you own reasoning. There is no SQLRooms agent or model to call.

1. Discover tables with `list_tables` and inspect the chosen canonical table ID
   with `read_table_schema`. Bare names may be ambiguous. Use qualified references.
2. Discover operations with `search_commands`; inspect their current input schemas
   with `get_command`. Invoke them through `execute_command`.
3. Read [documents](references/documents.md) before authoring. For visualization
   work also read [charts](references/charts.md) and [maps](references/maps.md).
4. Read the existing document before mutation. Pass explicit IDs on every targeted
   operation. Retain unrelated blocks, map resources, IDs, and configuration.
5. Verify using document/map read commands and bounded data queries. Tool failures
   are failures: do not describe an intended operation as completed.

Connection metadata and permissions come from the host. Guidance grants no extra
permissions. Report only observed outcomes, with the actual table and affected
resources. Report table identities in human-readable `schema.table` form (you
may also include the SQL-quoted reference used by commands). Headless state inspection does not establish rendered correctness.
