React Flow-based canvas for building SQL + Vega node DAGs in SQLRooms apps.

This package includes:

- `createCanvasSlice()` for canvas state/actions
- `Canvas` component for graph editing/execution
- `CanvasSliceConfig` Zod schema for persistence

The slice stores nodes/edges in `canvas.config` and supports topological downstream execution for SQL nodes.

## Installation

```bash
npm install @sqlrooms/canvas @sqlrooms/room-shell @sqlrooms/duckdb @sqlrooms/ui
```

## Quick start

```tsx
import {Canvas, CanvasSliceState, createCanvasSlice} from '@sqlrooms/canvas';
import {
  createRoomShellSlice,
  createRoomStore,
  LayoutTypes,
  RoomShellSliceState,
} from '@sqlrooms/room-shell';

type RoomState = RoomShellSliceState & CanvasSliceState;

export const {roomStore, useRoomStore} = createRoomStore<RoomState>(
  (set, get, store) => ({
    ...createRoomShellSlice({
      config: {
        dataSources: [
          {
            type: 'url',
            tableName: 'earthquakes',
            url: 'https://huggingface.co/datasets/sqlrooms/earthquakes/resolve/main/earthquakes.parquet',
          },
        ],
      },
      layout: {
        config: {
          type: LayoutTypes.enum.mosaic,
          nodes: 'main',
        },
        panels: {
          main: {
            title: 'Canvas',
            icon: () => null,
            component: Canvas,
            placement: 'main',
          },
        },
      },
    })(set, get, store),
    ...createCanvasSlice({
      ai: {
        getApiKey: () => '',
        // Keep this aligned with your app's recommended low-latency model.
        defaultModel: 'gpt-5.2-mini',
      },
    })(set, get, store),
  }),
);
```

## Programmatic canvas actions

```tsx
function CanvasActions() {
  const addNode = useRoomStore((state) => state.canvas.addNode);
  const executeSqlNodeQuery = useRoomStore(
    (state) => state.canvas.executeSqlNodeQuery,
  );

  const addAndRun = async () => {
    const nodeId = addNode({nodeType: 'sql'});
    await executeSqlNodeQuery(nodeId);
  };

  return <button onClick={() => void addAndRun()}>Add SQL node</button>;
}
```

## Persistence

Use `CanvasSliceConfig` with `persistSliceConfigs`:

```ts
import {CanvasSliceConfig} from '@sqlrooms/canvas';

sliceConfigSchemas: {
  canvas: CanvasSliceConfig,
}
```

## Example

- Canvas example app: https://github.com/sqlrooms/examples/tree/main/canvas
