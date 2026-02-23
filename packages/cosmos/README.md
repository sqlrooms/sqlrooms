GPU-accelerated graph visualization components and slice for SQLRooms (powered by Cosmograph Cosmos).

## Installation

```bash
npm install @sqlrooms/cosmos @sqlrooms/room-shell @sqlrooms/ui
```

## Store setup

```tsx
import {CosmosSliceState, createCosmosSlice} from '@sqlrooms/cosmos';
import {
  createRoomShellSlice,
  createRoomStore,
  RoomShellSliceState,
} from '@sqlrooms/room-shell';

type RoomState = RoomShellSliceState & CosmosSliceState;

export const {roomStore, useRoomStore} = createRoomStore<RoomState>(
  (set, get, store) => ({
    ...createRoomShellSlice({
      config: {title: 'Cosmos Demo', dataSources: []},
    })(set, get, store),
    ...createCosmosSlice()(set, get, store),
  }),
);
```

## Render a graph

```tsx
import {CosmosGraph, CosmosGraphControls, CosmosSimulationControls} from '@sqlrooms/cosmos';
import {GraphConfigInterface} from '@cosmos.gl/graph';

const config: GraphConfigInterface = {
  backgroundColor: 'transparent',
  simulationGravity: 0.2,
  simulationRepulsion: 1,
  simulationLinkSpring: 1,
  simulationLinkDistance: 10,
};

const pointPositions = new Float32Array([
  0, 0, // node 0
  1, 0, // node 1
  0.5, 1, // node 2
]);
const pointSizes = new Float32Array([5, 5, 5]);
const pointColors = new Float32Array([
  1, 0, 0, 1,
  0, 1, 0, 1,
  0, 0, 1, 1,
]);
const linkIndexes = new Float32Array([
  0, 1,
  1, 2,
]);

export function GraphView() {
  return (
    <CosmosGraph
      config={config}
      pointPositions={pointPositions}
      pointSizes={pointSizes}
      pointColors={pointColors}
      linkIndexes={linkIndexes}
      renderPointTooltip={(index) => `Node ${index}`}
    >
      <CosmosGraphControls />
      <CosmosSimulationControls className="absolute right-2 top-2" />
    </CosmosGraph>
  );
}
```

## Update simulation programmatically

```tsx
import {useRoomStore} from './store';

function SimulationButtons() {
  const toggleSimulation = useRoomStore((state) => state.cosmos.toggleSimulation);
  const fitView = useRoomStore((state) => state.cosmos.fitView);
  const updateSimulationConfig = useRoomStore(
    (state) => state.cosmos.updateSimulationConfig,
  );

  return (
    <div className="flex gap-2">
      <button onClick={toggleSimulation}>Toggle simulation</button>
      <button onClick={fitView}>Fit view</button>
      <button onClick={() => updateSimulationConfig({simulationRepulsion: 1.5})}>
        Stronger repulsion
      </button>
    </div>
  );
}
```

## Example app

- https://github.com/sqlrooms/examples/tree/main/cosmos
