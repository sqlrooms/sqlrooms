# Upgrade Guide

This document provides detailed guidance for upgrading between different versions of SQLRooms packages. Each section outlines breaking changes, required code modifications, and implementation examples to ensure a smooth upgrade process.

When upgrading, please follow the version-specific instructions below that apply to your project. If you encounter any issues during the upgrade process, please refer to our [GitHub issues](https://github.com/sqlrooms/sqlrooms/issues) or contact support.

## 0.9.0

### @sqlrooms/project-config

- `BaseProjectConfig` moved to `@sqlrooms/project-builder`
- Zod schemas `*DataSource` moved to `@sqlrooms/duckdb`

### @sqlrooms/project-builder

- `createProjectSlice` renamed into `createProjectBuilderSlice`

- `createProjectStore` renamed into `createProjectBuilderStore`

- `ProjectState` renamed into `ProjectBuilderState`

- `ProjectState` renamed into `ProjectBuilderState`

- `projectId` and `setProjectId` removed: add custom state if necessary

- `INITIAL_BASE_PROJECT_STATE` renamed into `INITIAL_PROJECT_BUILDER_STATE`

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

### @sqlrooms/ai

- `TOOLS` is not exported anymore: use `useProjectStore(state => state.ai.tools)` instead

## 0.8.0

### @sqlrooms/project-builder

- `project.config` moved to top level of `ProjectStore`

This was done to simplify persistence. To migrate you need to pull it up in your slice creation code.

Before:

```typescript
const {projectStore, useProjectStore} = createProjectStore<
  AppConfig,
  AppState
>(
    (set, get, store) => ({
      ...createProjectSlice<AppConfig>({
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
  AppConfig,
  AppState
>(
    (set, get, store) => ({
      ...createProjectSlice<AppConfig>({
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
