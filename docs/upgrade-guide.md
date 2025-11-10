---
outline: 2
---

# Upgrade Guide

This document provides detailed guidance for upgrading between different versions of SQLRooms packages. Each section outlines breaking changes, required code modifications, and implementation examples to ensure a smooth upgrade process.

When upgrading, please follow the version-specific instructions below that apply to your project. If you encounter any issues during the upgrade process, please refer to our [GitHub issues](https://github.com/sqlrooms/sqlrooms/issues) or contact support.

## 0.26.0-rc.7

- There's no combined config in the store anymore
  state.config -> state.room.config

- room.setRoomConfig removed, use store.

## 0.25.0-rc.1

- createAiSlice init parameters changed:
  - Instead of customTools and toolsOptions use tools + createDefaultAiTools(store, toolsOptions)
  - getInstructions must be provided, but can use createDefaultAiInstructions(store)

## 0.24.28-rc.1

- Discuss config separated from RoomConfig to make it easier to persist separately and to simplify typing (`state.discuss.config` instead of `state.config.discuss`)

```tsx
const discussConfig = useRoomStore((state) => state.discuss.config);
```

After:

```tsx
const discussConfig = useRoomStore((state) => state.config.discuss);
```

If you were persisting this state, you will likely need a migration.

You should also remove `.merge(DiscussSliceConfig)` when defining your `RoomConfig`

## 0.19.0

We are trying to make the package structure more logical, especially, for new users of the SQLRooms framework. Sorry for the more renaming.

- Package `@sqlrooms/core` (previously, `@sqlrooms/project`) renamed to `@sqlrooms/room-store`.

- The layout-related state and functions were moved to the new `LayoutSlice` added to `@sqlrooms/layout` which is namespaced as `layout`:
  - `panels`
  - `setLayout`
  - `togglePanel`
  - `tooglePanelPin`

Before:

```tsx
const togglePanel = useRoomStore((state) => state.room.togglePanel);
```

After:

```tsx
const togglePanel = useRoomStore((state) => state.layout.togglePanel);
```

## 0.18.0

`QueryHandle` returned from `.query()` is now implementing `PromiseLike` and can be awaited. So adding `.result`, which was introduced in [0.16.0](#_0-16-0), is not necessary anymore.

### Old

```tsx
const result = await connector.query('SELECT * FROM some_table').result;
```

### New

```tsx
const result = await connector.query('SELECT * FROM some_table');
```

## 0.17.0

This release focuses on standardizing terminology across the codebase and improving the developer experience for new users. We are replacing the concept of "project" with "room" to better align with the SQLRooms name. "Room" is an established concept in collaborative apps and fits well with the overall vision of the project.

### Package name changes

- `@sqlrooms/project` renamed to `@sqlrooms/core` (renamed again to `@sqlrooms/room-store` in [0.19.0](#_0-19-0), sorry)
- `@sqlrooms/project-config` renamed to `@sqlrooms/room-config`
- `@sqlrooms/project-builder` renamed to `@sqlrooms/room-shell`

### Component name changes

- `ProjectBuilder` is replaced by `RoomShell`
- `ProjectBuilderProvider` is removed (in favor of `RoomShell`)
- `ProjectBuilderState` renamed to `RoomShellSliceState`
- `createProjectBuilderStore` renamed to `createRoomStore`
- `createProjectBuilderSlice` renamed to `createRoomShellSlice`
- `ProjectBuilderPanel` renamed to `RoomPanel`
- `ProjectBuilderPanelHeader` renamed to `RoomPanelHeader`

#### Old way to set up a project

```tsx
<ProjectBuilderProvider projectStore={projectStore}>
  <div className="flex h-full w-full">
    <div className="bg-muted/50 flex h-full flex-col px-1 py-2">
      <ProjectBuilderSidebarButtons />
    </div>
    <div className="flex h-full w-full flex-col">
      <ProjectBuilder />
    </div>
  </div>
</ProjectBuilderProvider>
```

#### New

```tsx
<RoomShell className="h-screen" roomStore={roomStore}>
  <RoomShell.Sidebar />
  <RoomShell.LayoutComposer />
  <RoomShell.LoadingProgress />
</RoomShell>
```

### State name changes

- `state.project` namespace renamed to `state.room`

#### Old

```tsx
const dataSources = useProjectStore((state) => state.project.dataSources);
```

#### New

```tsx
const dataSources = useRoomStore((state) => state.room.dataSources);
```

## 0.16.3

### @sqlrooms/duckdb

The `BaseDuckDbConnector` and `WasmDuckDbConnector` are now provided as factory functions rather than classes. Use `createWasmDuckDbConnector()` or the generic `createDuckDbConnector({type: 'wasm'})` to obtain a connector instance.

#### Before

```typescript
import {WasmDuckDbConnector} from '@sqlrooms/duckdb';

const connector = new WasmDuckDbConnector();
```

#### After

```typescript
import {createWasmDuckDbConnector} from '@sqlrooms/duckdb';

const connector = createWasmDuckDbConnector();
```

## 0.16.0

### @sqlrooms/duckdb

The DuckDbConnector now supports query cancellation through a unified `QueryHandle` interface with full composability support. All query methods (`execute`, `query`, `queryJson`) now return a `QueryHandle` that provides immediate access to cancellation functionality and signal composability. [Read more…](https://sqlrooms.org/query-cancellation)

#### Old

```tsx
const result = await connector.query('SELECT * FROM some_table');
```

#### New

::: warning
Since [0.18.0](#_0-18-0) `QueryHandle` returned from `.query()` is implementing `PromiseLike` and can be awaited. So adding `.result` is not necessary anymore.
:::

```tsx
const result = await connector.query('SELECT * FROM some_table').result;
```

## 0.14.0

### @sqlrooms/ui

- `sqlroomsTailwindPreset` prefix parameter was removed

## 0.9.0

### @sqlrooms/project-builder

- `createProjectSlice` renamed into `createProjectBuilderSlice`

- `createProjectStore` renamed into `createProjectBuilderStore`

- `ProjectState` renamed into `ProjectBuilderState`

- `projectId` and `setProjectId` removed: add custom state if necessary

- `INITIAL_BASE_PROJECT_STATE` renamed into `INITIAL_PROJECT_BUILDER_STATE`

- A number of project store props and moved from `.project` to `.db`:
  - `.tables`
  - `.addTable`
  - `.getTable`
  - `.getTables`
  - `.getTableRowCount`
  - `.getTableSchema`
  - `.getTableSchemas`
  - `.checkTableExists`
  - `.dropTable`
  - `.createTableFromQuery`
  - `.setTableRowCount`
  - `.findTableByName`
  - `.refreshTableSchemas`

- `useBaseProjectStore` was renamed into `useBaseProjectBuilderStore`, but it's better to use `useProjectStore` returned by `createProjectBuilderStore` instead

- `processDroppedFile()` is removed: Use `ProjectStore.addProjectFile` directly.

- `ProjectStore.replaceProjectFile` is removed: Use `ProjectStore.addProjectFile` instead.

- `ProjectStore.addProjectFile` parameter changes: The function now takes a File or a pathname instead of the result of `processDroppedFile()`.

- `ProjectStore.addProjectFile` behavior changes: The function will no longer attempt to create unique table names, but will overwrite the created table.

- `ProjectStore.areViewsReadyToRender` and `onDataUpdated` were removed

- `ProjectStore.setTables` removed: use `state.db.refreshTableSchemas()` instead.

- `ProjectStore.isReadOnly` was removed: pass `isReadOnly` as a prop to respective components instead

### @sqlrooms/duckdb

- `useDuckDb()` now returns an instance of [`DuckDbConnector`](api/duckdb/interfaces/DuckDbConnector) to enable support for external DuckDB

- `getDuckDb` was removed: Use `useDuckDb()` instead

- `getDuckTableSchemas` was removed: use `const getTableSchemas = useProjectStore(state => state.db.getTableSchemas)`

- `exportToCsv` was removed: Use `useExportToCsv` instead

### @sqlrooms/mosaic

- `getMosaicConnector` removed: Use `useMosaic` instead

### @sqlrooms/ai

- `TOOLS` is not exported anymore: use `useProjectStore(state => state.ai.tools)` instead

## 0.8.0

### @sqlrooms/project-builder

- `project.config` moved to top level of `ProjectStore`

This was done to simplify persistence. To migrate you need to pull it up in your slice creation code.

Before:

```typescript
const {projectStore, useProjectStore} = createProjectStore<
  RoomConfig,
  RoomState
>(
    (set, get, store) => ({
      ...createProjectSlice<RoomConfig>({
        project: {
          config: {
            ...
          },
          ...
        }
      })
    })
);
```

After:

```typescript
const {projectStore, useProjectStore} = createProjectStore<
  RoomConfig,
  RoomState
>(
    (set, get, store) => ({
      ...createProjectSlice<RoomConfig>({
        config: {
          ...
        },
        project: {
          ...
        }
      })
    })
);
```

Check the [AI example store code](https://github.com/sqlrooms/examples/blob/main/ai/src/store.ts).

### @sqlrooms/ai

- Model provider in `getApiKey`

`getApiKey` property of `createAiSlice` now takes `modelProvider`:

```typescript
...createAiSlice({
getApiKey: (modelProvider: string) => {
  return get()?.apiKeys[modelProvider] || '';
},
})(set, get, store),

```

- Combining `useScrollToBottom` and `useScrollToBottomButton`

`useScrollToBottom` is now combined with `useScrollToBottomButton`. `useScrollToBottom` now takes `dataToObserve`, `containerRef`, `endRef`. When the data changes, the hook will scroll to the bottom of the container.

- Vega Chart Tool is now a custom tool

The Vega Chart Tool is no longer included by default and must be explicitly provided as a custom tool to `createAiSlice`. You need to import it from `@sqlrooms/vega` and add it to the `customTools` object:

```typescript
import {createVegaChartTool} from '@sqlrooms/vega';

...createAiSlice({
  getApiKey: (modelProvider: string) => {
    return get()?.apiKeys[modelProvider] || '';
  },
  // Add custom tools
  customTools: {
    // Add the VegaChart tool from the vega package
    chart: createVegaChartTool(),
    // Other custom tools...
  },
})(set, get, store),
```

This change allows for more flexibility in configuring the chart tool and reduces bundle size for applications that don't need chart functionality.
