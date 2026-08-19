import {describe, expect, it, jest} from '@jest/globals';
import type {Graph, GraphConfig} from '@cosmos.gl/graph';
import {createStore} from 'zustand/vanilla';

jest.unstable_mockModule('@cosmos.gl/graph', () => ({
  Graph: jest.fn(),
}));

const {createCosmosSlice} = await import('../src/CosmosSlice');
const {Graph: GraphConstructor} = await import('@cosmos.gl/graph');
const MockGraphConstructor = jest.mocked(GraphConstructor);

function createGraph(
  enableSimulation: boolean,
  initialSimulationRunning: boolean,
  options: {isReady?: boolean; ready?: Promise<void>; progress?: number} = {},
) {
  let config: GraphConfig & {enableSimulation: boolean} = {enableSimulation};
  let isSimulationRunning = initialSimulationRunning;
  let isReady = options.isReady ?? true;
  let progress = options.progress ?? 0;
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
    get progress() {
      return progress;
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
        progress = 0;
      }
    }),
    render: jest.fn(),
    destroy: jest.fn(),
    finish: jest.fn(() => {
      isSimulationRunning = false;
      progress = 1;
      config.onSimulationEnd?.();
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
  it('passes initial-only configuration into the Graph constructor', () => {
    const graph = createGraph(true, false);
    MockGraphConstructor.mockImplementationOnce(
      () => graph as unknown as Graph,
    );
    const store = createStore(createCosmosSlice());
    const container = {} as HTMLDivElement;

    store.getState().cosmos.createGraph(container, {
      initialZoomLevel: 2,
      randomSeed: 'stable-layout',
      attribution: 'SQLRooms',
    });

    expect(MockGraphConstructor).toHaveBeenLastCalledWith(
      container,
      expect.objectContaining({
        initialZoomLevel: 2,
        randomSeed: 'stable-layout',
        attribution: 'SQLRooms',
      }),
    );
  });

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

  it('tracks simulation completion and reheats an ended simulation', () => {
    const graph = createGraph(true, true);
    const store = createTestStore(graph);
    const onSimulationEnd = jest.fn();

    store.getState().cosmos.updateGraphConfig({onSimulationEnd});
    graph.finish();

    expect(onSimulationEnd).toHaveBeenCalledTimes(1);
    expect(store.getState().cosmos.isSimulationRunning).toBe(false);

    store.getState().cosmos.toggleSimulation();
    expect(graph.start).toHaveBeenCalledWith(1);
    expect(graph.unpause).not.toHaveBeenCalled();
    expect(store.getState().cosmos.isSimulationRunning).toBe(true);
  });

  it('renders after injecting simulation energy', () => {
    const graph = createGraph(true, false);
    const store = createTestStore(graph);

    store.getState().cosmos.startWithEnergy();

    expect(graph.start).toHaveBeenCalledWith(1);
    expect(graph.render).toHaveBeenCalledTimes(1);
    expect(store.getState().cosmos.isSimulationRunning).toBe(true);
  });
});
