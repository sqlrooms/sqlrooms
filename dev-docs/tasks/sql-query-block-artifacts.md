# SQL Query Block and Artifact

## Summary

Add a reusable SQL query block by refactoring `@sqlrooms/sql-editor` around
query instances and compound UI parts. Do not route this through
`@sqlrooms/cells` or create a one-cell artifact. The first implementation should
support both embedded worksheet blocks and top-level SQL query artifact tabs via
`createArtifactTypeFromStatefulBlock()`.

## Key Changes

- In `@sqlrooms/sql-editor`, make query execution id-addressable:
  - Add actions like `ensureQuery(queryId, options)`, `removeQuery(queryId)`,
    `runQueryById(queryId, query?)`, `abortQueryById(queryId)`, and
    `renameQuery(queryId, name)`.
  - Keep existing tab-oriented APIs (`parseAndRunCurrentQuery`,
    `parseAndRunQuery`, `abortCurrentQuery`) as compatibility wrappers around
    the id-based actions.
  - Keep persisted query state in `SqlEditorSliceConfig.queries` and runtime
    results in `queryResultsById`; do not introduce a separate SQL query slice.
- Refactor SQL editor UI into reusable compound parts:
  - Export a new `SqlQuery` compound component from `@sqlrooms/sql-editor`, with
    parts such as `Root`, `Header`/`Toolbar`, `Editor`, `Actions`/`RunButton`,
    and `Results`.
  - Existing components like `QueryEditorPanel`, `QueryEditorPanelEditor`,
    `QueryEditorPanelActions`, and `QueryResultPanel` should remain exported and
    be updated to accept an optional `queryId`, defaulting to the selected tab
    for backwards compatibility.
  - Keyboard run from the editor must run the query by its own `queryId`, not
    whichever tab is globally selected.
- Add a reusable SQL query stateful block definition:
  - Export `SqlQueryBlock` and `createSqlQueryBlockDefinition<TRoomState>()`
    from `@sqlrooms/sql-editor`.
  - The block uses `blockId`/`blockInstanceId` as the query id, ensures query
    state on create/ensure, removes query state on delete, and mirrors
    artifact/block title into the query name on rename.
  - Mark capabilities as stateful/executable; do not claim DAG or
    relation-producing capabilities for v1.
- Wire it into the CLI app:
  - Add `sql-query` to `STATEFUL_BLOCK_ARTIFACT_CONFIGS` so worksheets can
    insert SQL query blocks through the existing BlockDocument stateful block
    menu and commands.
  - Register the block renderer in `WorksheetArtifact`.
  - Add `sql-query` to `CLI_ARTIFACT_TYPES` and `ARTIFACT_TYPES` using
    `createArtifactTypeFromStatefulBlock(sqlQueryBlockDefinition)`, so queries
    can open as artifact tabs.
  - Use the same `SqlQueryBlock` UI for both embedded blocks and top-level query
    artifacts, with layout/style differences handled by props or compound
    composition.

## Public API / Interface Additions

- `@sqlrooms/sql-editor` exports:
  - `SqlQuery`
  - `SqlQueryBlock`
  - `createSqlQueryBlockDefinition`
  - id-based query slice actions on `SqlEditorSliceState`
- Existing SQL editor exports remain source-compatible.
- Existing persisted `sqlEditor` config shape remains compatible; adding query
  entries for block-backed queries uses the existing query record shape.

## Test Plan

- Add or update `@sqlrooms/sql-editor` tests for:
  - `ensureQuery` creates an id-stable query without selecting/opening it unless
    requested.
  - `runQueryById` stores loading/success/error/aborted results under that query
    id.
  - selected-tab APIs still behave as before by delegating to id-based actions.
  - deleting a query removes its runtime result and does not break remaining
    tabs.
- Add component coverage where practical:
  - `QueryResultPanel queryId` reads the requested query result.
  - `QueryEditorPanelEditor` keyboard run executes its own query id.
- Add CLI integration coverage or focused smoke tests:
  - Worksheet stateful block creation creates/ensures SQL query backing state.
  - Removing an owned SQL query block deletes its query state.
  - Creating a top-level SQL query artifact uses the same backing state and
    renderer.

## Assumptions

- V1 SQL query blocks are standalone query/result snippets, not notebook cells
  and not DAG participants.
- V1 query results use the current SQL editor result behavior, including result
  limits, rather than materializing reusable relations.
- The reusable implementation lives in `@sqlrooms/sql-editor`; the CLI app only
  registers it as a worksheet block and artifact type.
