# Upgrade Guide

## Introduction

This document provides detailed guidance for upgrading between different versions of SQLRooms packages. Each section outlines breaking changes, required code modifications, and implementation examples to ensure a smooth upgrade process.

When upgrading, please follow the version-specific instructions below that apply to your project. If you encounter any issues during the upgrade process, please refer to our [GitHub issues](https://github.com/sqlrooms/sqlrooms/issues) or contact support.

Here we document breaking changes.

## 0.8.0

### @sqlrooms/project-builder

#### `project.config` moved to top level of `ProjectStore`

This was done to simplify persistence. To migrate you need to pull it up in your slice creation code.

Before:

```
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

```
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

#### Model provider in `getApiKey`

`getApiKey` property of `createAiSlice` now takes `modelProvider`:

```
...createAiSlice({
getApiKey: (modelProvider: string) => {
  return get()?.apiKeys[modelProvider] || '';
},
})(set, get, store),

```

#### Combining `useScrollToBottom` and `useScrollToBottomButton`

`useScrollToBottom` is now combined with `useScrollToBottomButton`. `useScrollToBottom` now takes `dataToObserve`, `containerRef`, `endRef`. When the data changes, the hook will scroll to the bottom of the container.

#### Vega Chart Tool is now a custom tool

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
