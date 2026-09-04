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
import {
  CosmosGraph,
  CosmosGraphControls,
  CosmosSimulationControls,
  type GraphConfig,
} from '@sqlrooms/cosmos';

const config: GraphConfig = {
  backgroundColor: 'transparent',
  simulationGravity: 0.2,
  simulationRepulsion: 1,
  simulationLinkSpring: 1,
  simulationLinkDistance: 10,
};

const pointPositions = new Float32Array([
  0,
  0, // node 0
  1,
  0, // node 1
  0.5,
  1, // node 2
]);
const pointSizes = new Float32Array([5, 5, 5]);
const pointColors = new Float32Array([1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 1]);
const linkIndexes = new Float32Array([0, 1, 1, 2]);

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
      <CosmosSimulationControls className="absolute top-2 right-2" />
    </CosmosGraph>
  );
}
```

## Migrating from Cosmos 2

Cosmos 3 renamed the default link arrow option. Replace `linkArrows` with
`linkDefaultArrows` in room configuration. Persisted SQLRooms workspace data is
migrated automatically when it is rehydrated:

```ts
const config = {
  // linkArrows: true,
  linkDefaultArrows: true,
};
```

Cosmos 3 also requires Vite to prefer the ESM entry for `gl-bench`; its browser
entry is a global script. Add the following resolution order to Vite apps that
consume `@sqlrooms/cosmos`:

```ts
import {defineConfig} from 'vite';

export default defineConfig({
  resolve: {
    mainFields: ['module', 'browser', 'jsnext:main', 'jsnext'],
  },
});
```

## Update simulation programmatically

```tsx
import {useRoomStore} from './store';
import {Button} from '@sqlrooms/ui';

function SimulationButtons() {
  const toggleSimulation = useRoomStore(
    (state) => state.cosmos.toggleSimulation,
  );
  const fitView = useRoomStore((state) => state.cosmos.fitView);
  const updateSimulationConfig = useRoomStore(
    (state) => state.cosmos.updateSimulationConfig,
  );

  return (
    <div className="flex gap-2">
      <Button onClick={toggleSimulation}>Toggle simulation</Button>
      <Button onClick={fitView}>Fit view</Button>
      <Button
        onClick={() => updateSimulationConfig({simulationRepulsion: 1.5})}
      >
        Stronger repulsion
      </Button>
    </div>
  );
}
```

## Example app

- https://github.com/sqlrooms/examples/tree/main/cosmos
