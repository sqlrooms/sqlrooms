A powerful graph visualization package for SQLRooms applications. This package provides React components and hooks for creating interactive graph visualizations using a WebGL-based graph rendering engine, with state management through Zustand.

This package is built on top of the [Cosmos library](https://github.com/cosmograph-org/cosmos), a GPU-accelerated force graph layout and rendering library.

## Features

- 🌐 **Interactive Graphs**: Create dynamic, interactive graph visualizations
- 🚀 **WebGL Rendering**: High-performance rendering for large graphs
- 🧩 **React Components**: Ready-to-use components for graph visualization
- 🔄 **State Management**: Zustand-based state management for graph state
- 🎛️ **Simulation Controls**: Fine-grained control over physics simulation
- 🎨 **Customizable Styling**: Extensive options for visual customization

## Installation

```bash
npm install @sqlrooms/cosmos
```

## Basic Usage

### Simple Graph Visualization

```tsx
import {
  CosmosGraph,
  CosmosGraphControls,
  createDefaultCosmosConfig,
} from '@sqlrooms/cosmos';

function MyGraph() {
  const graphData = {
    nodes: [
      {id: 'node1', label: 'Node 1'},
      {id: 'node2', label: 'Node 2'},
      {id: 'node3', label: 'Node 3'},
    ],
    links: [
      {source: 'node1', target: 'node2'},
      {source: 'node2', target: 'node3'},
      {source: 'node3', target: 'node1'},
    ],
  };

  return (
    <div style={{width: '800px', height: '600px'}}>
      <CosmosGraph config={createDefaultCosmosConfig()} data={graphData}>
        <CosmosGraphControls />
      </CosmosGraph>
    </div>
  );
}
```

### With Simulation Controls

```tsx
import {
  CosmosGraph,
  CosmosGraphControls,
  CosmosSimulationControls,
  createDefaultCosmosConfig,
} from '@sqlrooms/cosmos';

function AdvancedGraph() {
  return (
    <div style={{width: '800px', height: '600px', position: 'relative'}}>
      <CosmosGraph config={createDefaultCosmosConfig()} data={graphData}>
        <CosmosGraphControls />
        <CosmosSimulationControls className="absolute bottom-4 left-4" />
      </CosmosGraph>
    </div>
  );
}
```

### Using with Zustand Store

```tsx
import {
  createCosmosSlice,
  useStoreWithCosmos,
  createDefaultCosmosConfig,
} from '@sqlrooms/cosmos';
import {createProjectStore} from '@sqlrooms/project-builder';

// Create a project store with cosmos capabilities
const useStore = createProjectStore({
  cosmos: createCosmosSlice(createDefaultCosmosConfig()),
});

function GraphWithState() {
  const {setGraphData, toggleSimulation, isSimulationRunning, zoomToFit} =
    useStoreWithCosmos(useStore);

  // Load graph data
  useEffect(() => {
    setGraphData(myGraphData);
  }, []);

  return (
    <div>
      <button onClick={toggleSimulation}>
        {isSimulationRunning ? 'Pause' : 'Resume'} Simulation
      </button>
      <button onClick={zoomToFit}>Zoom to Fit</button>

      <CosmosGraph store={useStore}>
        <CosmosGraphControls />
      </CosmosGraph>
    </div>
  );
}
```

## Configuration

The Cosmos graph visualization system provides extensive configuration options for both visual appearance and physics simulation.

### Visual Configuration

```tsx
const config = {
  pointSizeScale: 1.2, // Base scale for node sizes
  scalePointsOnZoom: true, // Dynamic node sizing with zoom
  renderLinks: true, // Toggle link visibility
  linkArrows: true, // Show directional arrows
  curvedLinks: true, // Use curved links
  linkWidth: 1.5, // Width of links
  linkOpacity: 0.8, // Opacity of links
  // ... other visual options
};
```

### Physics Simulation Configuration

```tsx
const config = {
  simulationGravity: 0.2, // Center attraction strength
  simulationRepulsion: 1.0, // Node repulsion strength
  simulationLinkSpring: 1.2, // Link elasticity
  simulationLinkDistance: 15, // Preferred link distance
  simulationFriction: 0.85, // Movement damping
  simulationDecay: 1000, // Simulation cooling rate
  // ... other physics options
};
```

## Advanced Features

- **Custom Node Rendering**: Define custom renderers for nodes
- **Interactive Events**: Handle click, hover, and drag events
- **Data Binding**: Connect graph data to your application state
- **Layout Algorithms**: Apply different layout algorithms
- **Performance Optimization**: Options for handling large graphs

For more information, visit the SQLRooms documentation.

## About Cosmograph Cosmos

This package is built on top of [Cosmograph Cosmos](https://github.com/cosmograph-org/cosmos), a GPU-accelerated force graph layout and rendering library. Cosmograph Cosmos offers:

- **GPU Acceleration**: All computations and rendering happen on the GPU in fragment and vertex shaders
- **High Performance**: Capable of rendering hundreds of thousands of nodes and links in real-time
- **WebGL-based**: Utilizes WebGL for efficient graph visualization
- **Advanced Physics**: Sophisticated force-directed layout algorithms

For more information about the underlying library, visit the [Cosmograph Cosmos GitHub repository](https://github.com/cosmograph-org/cosmos) or the [official documentation](https://cosmograph-org.github.io/cosmos/).
