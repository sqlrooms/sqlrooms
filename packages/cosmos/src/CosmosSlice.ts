/**
 * @fileoverview Cosmos graph visualization state management using Zustand.
 * This module provides state management and control functions for the Cosmos graph visualization.
 */

import {Graph, type GraphConfig} from '@cosmos.gl/graph';
import {
  createSlice,
  useBaseRoomShellStore,
  type RoomShellSliceState,
} from '@sqlrooms/room-shell';
import {produce} from 'immer';
import type {StateCreator} from 'zustand';
import {
  CosmosSliceConfig,
  createDefaultCosmosConfig,
} from './CosmosSliceConfig';

/**
 * Core state interface for the Cosmos graph visualization.
 * Contains the graph instance, simulation state, and all control functions.
 */
export type CosmosSliceState = {
  cosmos: {
    config: CosmosSliceConfig;
    /** The current graph instance */
    graph: Graph | null;
    /** Whether the physics simulation is currently running */
    isSimulationRunning: boolean;
    /** Sets the config for the cosmos slice */
    setConfig: (config: CosmosSliceConfig) => void;
    /** Creates a graph with constructor-time configuration in the container */
    createGraph: (container: HTMLDivElement, config?: GraphConfig) => void;
    /** Toggles the physics simulation on/off */
    toggleSimulation: () => void;
    /** Adjusts the view to fit all nodes */
    fitView: () => void;
    /** Starts the simulation with initial energy */
    startWithEnergy: () => void;
    /** Cleans up and removes the current graph */
    destroyGraph: () => void;
    /** Updates the simulation configuration parameters */
    updateSimulationConfig: (config: Partial<CosmosSliceConfig>) => void;
    /** Updates the graph's visual configuration */
    updateGraphConfig: (config: GraphConfig) => void;
    /** Updates the graph's data (points, links, colors, etc.) */
    updateGraphData: (data: {
      pointPositions?: Float32Array;
      pointColors?: Float32Array;
      pointSizes?: Float32Array;
      linkIndexes?: Float32Array;
      linkColors?: Float32Array;
    }) => void;
    /** Sets the currently focused point by its index */
    setFocusedPoint: (index: number | undefined) => void;
    /** Sets the zoom level of the graph view */
    setZoomLevel: (level: number) => void;
  };
};

type CosmosSliceSet = Parameters<StateCreator<CosmosSliceState>>[0];
type CosmosSliceGet = Parameters<StateCreator<CosmosSliceState>>[1];

type SimulationLifecycleCallbacks = Pick<
  GraphConfig,
  | 'onSimulationStart'
  | 'onSimulationEnd'
  | 'onSimulationPause'
  | 'onSimulationUnpause'
>;

type SimulationLifecycle = {
  callbacks: SimulationLifecycleCallbacks;
  handlers: SimulationLifecycleCallbacks;
};

const graphSimulationLifecycles = new WeakMap<Graph, SimulationLifecycle>();

function setSimulationRunning(
  set: CosmosSliceSet,
  get: CosmosSliceGet,
  graph: Graph,
  isSimulationRunning: boolean,
) {
  if (get().cosmos.graph !== graph) return;

  set((state) =>
    produce(state, (draft) => {
      draft.cosmos.isSimulationRunning = isSimulationRunning;
    }),
  );
}

function updateSimulationLifecycleCallbacks(
  callbacks: SimulationLifecycleCallbacks,
  config: GraphConfig,
) {
  if (Object.hasOwn(config, 'onSimulationStart')) {
    callbacks.onSimulationStart = config.onSimulationStart;
  }
  if (Object.hasOwn(config, 'onSimulationEnd')) {
    callbacks.onSimulationEnd = config.onSimulationEnd;
  }
  if (Object.hasOwn(config, 'onSimulationPause')) {
    callbacks.onSimulationPause = config.onSimulationPause;
  }
  if (Object.hasOwn(config, 'onSimulationUnpause')) {
    callbacks.onSimulationUnpause = config.onSimulationUnpause;
  }
}

function createSimulationLifecycle(
  set: CosmosSliceSet,
  get: CosmosSliceGet,
  getGraph: () => Graph | undefined,
  config: GraphConfig,
): SimulationLifecycle {
  const callbacks: SimulationLifecycleCallbacks = {};
  updateSimulationLifecycleCallbacks(callbacks, config);

  return {
    callbacks,
    handlers: {
      onSimulationStart: () => {
        const graph = getGraph();
        if (graph) setSimulationRunning(set, get, graph, true);
        callbacks.onSimulationStart?.();
      },
      onSimulationEnd: () => {
        const graph = getGraph();
        if (graph) setSimulationRunning(set, get, graph, false);
        callbacks.onSimulationEnd?.();
      },
      onSimulationPause: () => {
        const graph = getGraph();
        if (graph) setSimulationRunning(set, get, graph, false);
        callbacks.onSimulationPause?.();
      },
      onSimulationUnpause: () => {
        const graph = getGraph();
        if (graph) setSimulationRunning(set, get, graph, true);
        callbacks.onSimulationUnpause?.();
      },
    },
  };
}

function getSimulationLifecycle(
  set: CosmosSliceSet,
  get: CosmosSliceGet,
  graph: Graph,
  config: GraphConfig,
) {
  let lifecycle = graphSimulationLifecycles.get(graph);
  if (!lifecycle) {
    lifecycle = createSimulationLifecycle(set, get, () => graph, config);
    graphSimulationLifecycles.set(graph, lifecycle);
  } else {
    updateSimulationLifecycleCallbacks(lifecycle.callbacks, config);
  }
  return lifecycle;
}

function syncSimulationState(
  set: CosmosSliceSet,
  get: CosmosSliceGet,
  graph: Graph,
  fallback: boolean,
) {
  const sync = () => {
    if (get().cosmos.graph !== graph) return;

    const isSimulationRunning = graph.isReady
      ? graph.isSimulationRunning
      : fallback;
    set((state) =>
      produce(state, (draft) => {
        draft.cosmos.isSimulationRunning = isSimulationRunning;
      }),
    );
  };

  sync();
  if (!graph.isReady) {
    void graph.ready.then(sync, () => undefined);
  }
}

/**
 * Creates a Zustand slice for managing Cosmos graph state.
 * This slice handles graph creation, destruction, configuration, and data updates.
 *
 * @returns A state creator function for the Cosmos slice
 */
export function createCosmosSlice(): StateCreator<CosmosSliceState> {
  return createSlice<CosmosSliceState>((set, get) => ({
    cosmos: {
      graph: null,
      isSimulationRunning: true,
      config: createDefaultCosmosConfig(),

      setConfig: (config) => {
        set((state) =>
          produce(state, (draft) => {
            draft.cosmos.config = config;
          }),
        );
      },

      createGraph: (container: HTMLDivElement, initialConfig = {}) => {
        // Clean up old graph if it exists
        const oldGraph = get().cosmos.graph;
        if (oldGraph) {
          oldGraph.pause();
          oldGraph.destroy();
        }

        // Create and configure new graph
        const config = {...get().cosmos.config, ...initialConfig};
        const graphRef: {current?: Graph} = {};
        const lifecycle = createSimulationLifecycle(
          set,
          get,
          () => graphRef.current,
          config,
        );
        const graph = new Graph(container, {...config, ...lifecycle.handlers});
        graphRef.current = graph;
        graphSimulationLifecycles.set(graph, lifecycle);
        graph.start();

        set((state) =>
          produce(state, (draft) => {
            draft.cosmos.graph = graph;
            draft.cosmos.isSimulationRunning = graph.config.enableSimulation;
          }),
        );
        syncSimulationState(set, get, graph, graph.config.enableSimulation);
      },

      toggleSimulation: () => {
        const {graph, isSimulationRunning} = get().cosmos;
        if (!graph) return;

        if (isSimulationRunning) {
          graph.pause();
          syncSimulationState(set, get, graph, false);
        } else {
          if (graph.progress >= 1) {
            graph.start(1);
          } else {
            graph.unpause();
          }
          syncSimulationState(set, get, graph, graph.config.enableSimulation);
        }
      },

      fitView: () => {
        const {graph} = get().cosmos;
        if (!graph) return;
        graph.fitView();
      },

      startWithEnergy: () => {
        const {graph} = get().cosmos;
        if (!graph) return;
        graph.start(1);
        graph.render();
        syncSimulationState(set, get, graph, graph.config.enableSimulation);
      },

      updateSimulationConfig: (config: Partial<CosmosSliceConfig>) => {
        const {graph} = get().cosmos;
        graph?.setConfigPartial(config);

        set((state) =>
          produce(state, (draft) => {
            Object.assign(draft.cosmos.config, config);
          }),
        );
      },

      updateGraphConfig: (config: GraphConfig) => {
        const {graph, isSimulationRunning} = get().cosmos;
        if (graph) {
          const lifecycle = getSimulationLifecycle(set, get, graph, config);
          graph.setConfigPartial({...config, ...lifecycle.handlers});
        }

        set((state) =>
          produce(state, (draft) => {
            Object.assign(draft.cosmos.config, config);
          }),
        );

        if (graph) {
          syncSimulationState(
            set,
            get,
            graph,
            config.enableSimulation ?? isSimulationRunning,
          );
        }
      },

      updateGraphData: (data) => {
        const {graph} = get().cosmos;
        if (!graph) return;

        if (data.pointPositions) {
          graph.setPointPositions(data.pointPositions);
        }
        if (data.pointColors) {
          graph.setPointColors(data.pointColors);
        }
        if (data.pointSizes) {
          graph.setPointSizes(data.pointSizes);
        }
        if (data.linkIndexes) {
          graph.setLinks(data.linkIndexes);
        }
        if (data.linkColors) {
          graph.setLinkColors(data.linkColors);
        }

        graph.render();
      },

      setFocusedPoint: (index) => {
        const {graph} = get().cosmos;
        if (!graph) return;
        graph.setConfigPartial({
          focusedPointIndex: index,
        });
      },

      setZoomLevel: (level) => {
        const {graph} = get().cosmos;
        if (!graph) return;
        graph.setZoomLevel(level);
      },

      destroyGraph: () => {
        const {graph} = get().cosmos;
        if (!graph) return;
        // TODO: this should be happening in cosmos
        if ((graph as any).store.div?.firstChild) {
          (graph as any).store.div.innerHTML = '';
        }
        graph.pause();
        graph.destroy();
        graphSimulationLifecycles.delete(graph);
        set((state) =>
          produce(state, (draft) => {
            draft.cosmos.graph = null;
            draft.cosmos.isSimulationRunning = false;
          }),
        );
      },
    },
  }));
}

/**
 * Combined type representing the full room state including Cosmos functionality.
 * Merges the base room state with Cosmos-specific state and configuration.
 */
export type RoomStateWithCosmos = RoomShellSliceState & CosmosSliceState;

/**
 * Hook to access the Cosmos store with proper typing.
 * Provides type-safe access to the combined room and Cosmos state.
 *
 * @template T The type of the selected state slice
 * @param selector A function that selects a portion of the state
 * @returns The selected state portion
 *
 * @example
 * ```typescript
 * const graph = useStoreWithCosmos(state => state.cosmos.graph);
 * const isRunning = useStoreWithCosmos(state => state.cosmos.isSimulationRunning);
 * ```
 */
export function useStoreWithCosmos<T>(
  selector: (state: RoomStateWithCosmos) => T,
): T {
  return useBaseRoomShellStore<RoomStateWithCosmos, T>((state) =>
    selector(state as RoomStateWithCosmos),
  );
}
