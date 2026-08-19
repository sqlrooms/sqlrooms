import {describe, expect, it, jest} from '@jest/globals';
import type {Graph, GraphConfig} from '@cosmos.gl/graph';
import {createStore} from 'zustand/vanilla';

jest.unstable_mockModule('@cosmos.gl/graph', () => ({
  Graph: jest.fn(),
}));

const {createCosmosSlice} = await import('../src/CosmosSlice');

class TestGraph {
  config: GraphConfig & {enableSimulation: boolean};
  isReady = true;
  ready = Promise.resolve();

  constructor(
    enableSimulation: boolean,
    public isSimulationRunning: boolean,
  ) {
    this.config = {enableSimulation};
  }

  pause = jest.fn(() => {
    this.isSimulationRunning = false;
  });

  unpause = jest.fn(() => {
    if (this.config.enableSimulation) {
      this.isSimulationRunning = true;
    }
  });

  start = jest.fn(() => {
    if (this.config.enableSimulation) {
      this.isSimulationRunning = true;
    }
  });

  setConfigPartial = jest.fn((config: GraphConfig) => {
    Object.assign(this.config, config);
    if (config.enableSimulation !== undefined) {
      this.isSimulationRunning = config.enableSimulation;
    }
  });
}

function createGraph(enableSimulation: boolean, isSimulationRunning: boolean) {
  return new TestGraph(enableSimulation, isSimulationRunning);
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
    const graph = createGraph(true, false);
    graph.isReady = false;
    graph.ready = new Promise<void>((resolve) => {
      resolveReady = resolve;
    });
    const store = createTestStore(graph);

    store.getState().cosmos.toggleSimulation();
    expect(graph.pause).toHaveBeenCalledTimes(1);
    expect(graph.unpause).not.toHaveBeenCalled();
    expect(store.getState().cosmos.isSimulationRunning).toBe(false);

    graph.isReady = true;
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
