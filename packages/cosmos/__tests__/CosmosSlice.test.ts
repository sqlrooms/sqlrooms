import {describe, expect, it, jest} from '@jest/globals';
import type {Graph, GraphConfig} from '@cosmos.gl/graph';
import {createStore} from 'zustand/vanilla';

jest.unstable_mockModule('@cosmos.gl/graph', () => ({
  Graph: jest.fn(),
}));

const {createCosmosSlice} = await import('../src/CosmosSlice');

function createGraph(
  enableSimulation: boolean,
  initialSimulationRunning: boolean,
  options: {isReady?: boolean; ready?: Promise<void>} = {},
) {
  let config: GraphConfig & {enableSimulation: boolean} = {enableSimulation};
  let isSimulationRunning = initialSimulationRunning;
  let isReady = options.isReady ?? true;
  const ready = options.ready ?? Promise.resolve();

  const graph = {
    get config() {
      return config;
    },
    get isReady() {
      return isReady;
    },
    get isSimulationRunning() {
      return isSimulationRunning;
    },
    ready,
    markReady: jest.fn(() => {
      isReady = true;
    }),
    pause: jest.fn(() => {
      isSimulationRunning = false;
    }),
    unpause: jest.fn(() => {
      if (config.enableSimulation) {
        isSimulationRunning = true;
      }
    }),
    start: jest.fn(() => {
      if (config.enableSimulation) {
        isSimulationRunning = true;
      }
    }),
    setConfigPartial: jest.fn((nextConfig: GraphConfig) => {
      config = {...config, ...nextConfig};
      if (nextConfig.enableSimulation !== undefined) {
        isSimulationRunning = nextConfig.enableSimulation;
      }
    }),
  };

  return graph;
}

function createTestStore(graph: ReturnType<typeof createGraph>) {
  const store = createStore(createCosmosSlice());
  store.setState((state) => ({
    ...state,
    cosmos: {...state.cosmos, graph: graph as unknown as Graph},
  }));
  return store;
}

describe('CosmosSlice simulation controls', () => {
  it('honors a queued pause while the graph is initializing', async () => {
    let resolveReady: () => void = () => undefined;
    const ready = new Promise<void>((resolve) => {
      resolveReady = resolve;
    });
    const graph = createGraph(true, false, {isReady: false, ready});
    const store = createTestStore(graph);

    store.getState().cosmos.toggleSimulation();
    expect(graph.pause).toHaveBeenCalledTimes(1);
    expect(graph.unpause).not.toHaveBeenCalled();
    expect(store.getState().cosmos.isSimulationRunning).toBe(false);

    graph.markReady();
    resolveReady();
    await graph.ready;
    expect(store.getState().cosmos.isSimulationRunning).toBe(false);
  });

  it('keeps disabled simulations stopped when configured or toggled', () => {
    const graph = createGraph(true, true);
    const store = createTestStore(graph);

    store.getState().cosmos.updateGraphConfig({enableSimulation: false});
    expect(store.getState().cosmos.isSimulationRunning).toBe(false);

    store.getState().cosmos.toggleSimulation();
    expect(graph.unpause).toHaveBeenCalledTimes(1);
    expect(store.getState().cosmos.isSimulationRunning).toBe(false);

    store.getState().cosmos.startWithEnergy();
    expect(store.getState().cosmos.isSimulationRunning).toBe(false);
  });

  it('tracks pause and unpause transitions', () => {
    const graph = createGraph(true, true);
    const store = createTestStore(graph);

    store.getState().cosmos.toggleSimulation();
    expect(graph.pause).toHaveBeenCalledTimes(1);
    expect(store.getState().cosmos.isSimulationRunning).toBe(false);

    store.getState().cosmos.toggleSimulation();
    expect(graph.unpause).toHaveBeenCalledTimes(1);
    expect(store.getState().cosmos.isSimulationRunning).toBe(true);
  });
});
