import {createStore} from 'zustand';
import {Graph} from '@cosmograph/cosmos';
import {jest} from '@jest/globals';
import {createCosmosSlice, CosmosSliceState} from '../src/CosmosSlice';
import {createBaseRoomSlice, BaseRoomStoreState} from '@sqlrooms/room-store';

type TestStoreState = BaseRoomStoreState & CosmosSliceState;

function createTestStore() {
  return createStore<TestStoreState>()((...args) => ({
    ...createBaseRoomSlice()(...args),
    ...createCosmosSlice()(...args),
  }));
}

// Mock the Graph class
jest.mock('@cosmograph/cosmos', () => ({
  Graph: jest.fn().mockImplementation(() => ({
    setConfig: jest.fn(),
    start: jest.fn(),
    pause: jest.fn(),
    restart: jest.fn(),
    destroy: jest.fn(),
    fitView: jest.fn(),
    setPointPositions: jest.fn(),
    setPointColors: jest.fn(),
    setPointSizes: jest.fn(),
    setLinks: jest.fn(),
    setLinkColors: jest.fn(),
    setZoomLevel: jest.fn(),
    render: jest.fn(),
    isSimulationRunning: false,
  })),
}));

describe('CosmosSlice', () => {
  let store: ReturnType<typeof createTestStore>;
  let mockContainer: HTMLDivElement;

  beforeEach(() => {
    store = createTestStore();
    mockContainer = document.createElement('div');
    (Graph as jest.Mock).mockClear();
  });

  describe('initialization', () => {
    it('should initialize with null graph and running simulation', () => {
      const state = store.getState();
      expect(state.cosmos.graph).toBeNull();
      expect(state.cosmos.isSimulationRunning).toBe(true);
    });

    it('should have default config', () => {
      const state = store.getState();
      expect(state.cosmos.config).toBeDefined();
      expect(state.cosmos.config.pointSizeScale).toBe(1.1);
    });
  });

  describe('createGraph', () => {
    it('should create a new graph instance', () => {
      store.getState().cosmos.createGraph(mockContainer);

      expect(Graph).toHaveBeenCalledWith(mockContainer);
      expect(store.getState().cosmos.graph).not.toBeNull();
    });

    it('should configure and start the graph', () => {
      store.getState().cosmos.createGraph(mockContainer);

      const graph = store.getState().cosmos.graph;
      expect(graph?.setConfig).toHaveBeenCalled();
      expect(graph?.start).toHaveBeenCalled();
    });

    it('should destroy old graph before creating new one', () => {
      store.getState().cosmos.createGraph(mockContainer);
      const firstGraph = store.getState().cosmos.graph;

      store.getState().cosmos.createGraph(mockContainer);

      expect(firstGraph?.pause).toHaveBeenCalled();
      expect(firstGraph?.destroy).toHaveBeenCalled();
    });
  });

  describe('toggleSimulation', () => {
    beforeEach(() => {
      store.getState().cosmos.createGraph(mockContainer);
    });

    it('should pause simulation when running', () => {
      const graph = store.getState().cosmos.graph;
      if (graph) {
        (graph as any).isSimulationRunning = true;
      }

      store.getState().cosmos.toggleSimulation();

      expect(graph?.pause).toHaveBeenCalled();
      expect(store.getState().cosmos.isSimulationRunning).toBe(false);
    });

    it('should restart simulation when paused', () => {
      const graph = store.getState().cosmos.graph;
      if (graph) {
        (graph as any).isSimulationRunning = false;
      }

      store.getState().cosmos.toggleSimulation();

      expect(graph?.restart).toHaveBeenCalled();
      expect(store.getState().cosmos.isSimulationRunning).toBe(true);
    });
  });

  describe('fitView', () => {
    it('should call fitView on graph', () => {
      store.getState().cosmos.createGraph(mockContainer);
      const graph = store.getState().cosmos.graph;

      store.getState().cosmos.fitView();

      expect(graph?.fitView).toHaveBeenCalled();
    });

    it('should not error if graph is null', () => {
      expect(() => {
        store.getState().cosmos.fitView();
      }).not.toThrow();
    });
  });

  describe('startWithEnergy', () => {
    it('should start graph with energy level 1', () => {
      store.getState().cosmos.createGraph(mockContainer);
      const graph = store.getState().cosmos.graph;

      store.getState().cosmos.startWithEnergy();

      expect(graph?.start).toHaveBeenCalledWith(1);
      expect(store.getState().cosmos.isSimulationRunning).toBe(true);
    });
  });

  describe('updateGraphConfig', () => {
    it('should update config in state and on graph', () => {
      store.getState().cosmos.createGraph(mockContainer);
      const graph = store.getState().cosmos.graph;

      store.getState().cosmos.updateGraphConfig({
        pointSizeScale: 2.0,
      });

      expect(store.getState().cosmos.config.pointSizeScale).toBe(2.0);
      expect(graph?.setConfig).toHaveBeenCalled();
    });

    it('should update config even if graph is null', () => {
      store.getState().cosmos.updateGraphConfig({
        simulationGravity: 0.5,
      });

      expect(store.getState().cosmos.config.simulationGravity).toBe(0.5);
    });
  });

  describe('updateGraphData', () => {
    beforeEach(() => {
      store.getState().cosmos.createGraph(mockContainer);
    });

    it('should update point positions', () => {
      const positions = new Float32Array([0, 0, 1, 1]);
      const graph = store.getState().cosmos.graph;

      store.getState().cosmos.updateGraphData({
        pointPositions: positions,
      });

      expect(graph?.setPointPositions).toHaveBeenCalledWith(positions);
      expect(graph?.render).toHaveBeenCalled();
    });

    it('should update point colors', () => {
      const colors = new Float32Array([1, 0, 0, 1]);
      const graph = store.getState().cosmos.graph;

      store.getState().cosmos.updateGraphData({
        pointColors: colors,
      });

      expect(graph?.setPointColors).toHaveBeenCalledWith(colors);
      expect(graph?.render).toHaveBeenCalled();
    });

    it('should update all data types', () => {
      const graph = store.getState().cosmos.graph;
      const data = {
        pointPositions: new Float32Array([0, 0]),
        pointColors: new Float32Array([1, 0, 0, 1]),
        pointSizes: new Float32Array([5]),
        linkIndexes: new Float32Array([0, 1]),
        linkColors: new Float32Array([0, 1, 0, 1]),
      };

      store.getState().cosmos.updateGraphData(data);

      expect(graph?.setPointPositions).toHaveBeenCalledWith(
        data.pointPositions,
      );
      expect(graph?.setPointColors).toHaveBeenCalledWith(data.pointColors);
      expect(graph?.setPointSizes).toHaveBeenCalledWith(data.pointSizes);
      expect(graph?.setLinks).toHaveBeenCalledWith(data.linkIndexes);
      expect(graph?.setLinkColors).toHaveBeenCalledWith(data.linkColors);
      expect(graph?.render).toHaveBeenCalled();
    });
  });

  describe('setFocusedPoint', () => {
    it('should set focused point by index', () => {
      store.getState().cosmos.createGraph(mockContainer);
      const graph = store.getState().cosmos.graph;

      store.getState().cosmos.setFocusedPoint(5);

      expect(graph?.setConfig).toHaveBeenCalledWith({focusedPointIndex: 5});
    });

    it('should accept undefined to clear focus', () => {
      store.getState().cosmos.createGraph(mockContainer);
      const graph = store.getState().cosmos.graph;

      store.getState().cosmos.setFocusedPoint(undefined);

      expect(graph?.setConfig).toHaveBeenCalledWith({
        focusedPointIndex: undefined,
      });
    });
  });

  describe('setZoomLevel', () => {
    it('should set zoom level on graph', () => {
      store.getState().cosmos.createGraph(mockContainer);
      const graph = store.getState().cosmos.graph;

      store.getState().cosmos.setZoomLevel(2.5);

      expect(graph?.setZoomLevel).toHaveBeenCalledWith(2.5);
    });
  });

  describe('destroyGraph', () => {
    it('should clean up and destroy graph', () => {
      store.getState().cosmos.createGraph(mockContainer);
      const graph = store.getState().cosmos.graph;

      store.getState().cosmos.destroyGraph();

      expect(graph?.pause).toHaveBeenCalled();
      expect(graph?.destroy).toHaveBeenCalled();
      expect(store.getState().cosmos.graph).toBeNull();
      expect(store.getState().cosmos.isSimulationRunning).toBe(false);
    });

    it('should handle destroying when graph is already null', () => {
      expect(() => {
        store.getState().cosmos.destroyGraph();
      }).not.toThrow();
    });
  });

  describe('setConfig', () => {
    it('should update entire config', () => {
      const newConfig = {
        pointSizeScale: 2.0,
        scalePointsOnZoom: false,
        simulationGravity: 0.5,
        simulationRepulsion: 2.0,
        simulationLinkSpring: 1.5,
        simulationLinkDistance: 20,
        simulationFriction: 0.9,
        simulationDecay: 2000,
        renderLinks: false,
        linkArrows: true,
        curvedLinks: true,
        linkWidthScale: 2,
        linkArrowsSizeScale: 2,
      };

      store.getState().cosmos.setConfig(newConfig);

      expect(store.getState().cosmos.config).toEqual(newConfig);
    });
  });
});
