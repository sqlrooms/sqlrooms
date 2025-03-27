/**
 * @fileoverview Cosmos graph visualization state management using Zustand.
 * This module provides state management and control functions for the Cosmos graph visualization.
 */

import {Graph, GraphConfigInterface} from '@cosmograph/cosmos';
import {
  createSlice,
  useBaseProjectBuilderStore,
  type ProjectBuilderState,
} from '@sqlrooms/project-builder';
import type {BaseProjectConfig} from '@sqlrooms/project-config';
import type {StateCreator} from 'zustand';
import {CosmosSliceConfig} from './CosmosSliceConfig';
import {produce} from 'immer';

/**
 * Core state interface for the Cosmos graph visualization.
 * Contains the graph instance, simulation state, and all control functions.
 */
export type CosmosSliceState = {
  cosmos: {
    /** The current graph instance */
    graph: Graph | null;
    /** Whether the physics simulation is currently running */
    isSimulationRunning: boolean;
    /** Creates a new graph instance in the specified container */
    createGraph: (container: HTMLDivElement) => void;
    /** Toggles the physics simulation on/off */
    toggleSimulation: () => void;
    /** Adjusts the view to fit all nodes */
    fitView: () => void;
    /** Starts the simulation with initial energy */
    startWithEnergy: () => void;
    /** Cleans up and removes the current graph */
    destroyGraph: () => void;
    /** Updates the simulation configuration parameters */
    updateSimulationConfig: (
      config: Partial<CosmosSliceConfig['cosmos']>,
    ) => void;
    /** Updates the graph's visual configuration */
    updateGraphConfig: (config: Partial<GraphConfigInterface>) => void;
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

/**
 * Combined type representing the full project state including Cosmos functionality.
 * Merges the base project state with Cosmos-specific state and configuration.
 */
export type ProjectStateWithCosmos = ProjectBuilderState<
  BaseProjectConfig & CosmosSliceConfig
> &
  CosmosSliceState;

/**
 * Creates a Zustand slice for managing Cosmos graph state.
 * This slice handles graph creation, destruction, configuration, and data updates.
 *
 * @returns A state creator function for the Cosmos slice
 */
export function createCosmosSlice(): StateCreator<CosmosSliceState> {
  return createSlice<BaseProjectConfig & CosmosSliceConfig, CosmosSliceState>(
    (set, get) => ({
      cosmos: {
        graph: null,
        isSimulationRunning: true,

        createGraph: (container: HTMLDivElement) => {
          // Clean up old graph if it exists
          const oldGraph = get().cosmos.graph;
          if (oldGraph) {
            oldGraph.pause();
            oldGraph.destroy();
          }

          // Create and configure new graph
          const graph = new Graph(container);
          const config = get().config.cosmos;
          graph.setConfig(config);
          graph.start();

          set((state) =>
            produce(state, (draft) => {
              draft.cosmos.graph = graph;
            }),
          );
        },

        toggleSimulation: () => {
          const {graph} = get().cosmos;
          if (!graph) return;

          if (graph.isSimulationRunning) {
            graph.pause();
            set((state) =>
              produce(state, (draft) => {
                draft.cosmos.isSimulationRunning = false;
              }),
            );
          } else {
            graph.restart();
            set((state) =>
              produce(state, (draft) => {
                draft.cosmos.isSimulationRunning = true;
              }),
            );
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
          set((state) =>
            produce(state, (draft) => {
              draft.cosmos.isSimulationRunning = true;
            }),
          );
        },

        updateSimulationConfig: (
          config: Partial<CosmosSliceConfig['cosmos']>,
        ) => {
          const {graph} = get().cosmos;

          set((state) =>
            produce(state, (draft) => {
              Object.assign(draft.config.cosmos, config);
              if (graph) {
                graph.setConfig(draft.config.cosmos);
              }
            }),
          );
        },

        updateGraphConfig: (config: Partial<GraphConfigInterface>) => {
          const {graph} = get().cosmos;

          set((state) =>
            produce(state, (draft) => {
              Object.assign(draft.config.cosmos, config);
              if (graph) {
                graph.setConfig(draft.config.cosmos);
              }
            }),
          );
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
          graph.setFocusedPointByIndex(index);
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
          set((state) =>
            produce(state, (draft) => {
              draft.cosmos.graph = null;
              draft.cosmos.isSimulationRunning = false;
            }),
          );
        },
      },
    }),
  );
}

/**
 * Hook to access the Cosmos store with proper typing.
 * Provides type-safe access to the combined project and Cosmos state.
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
  selector: (state: ProjectStateWithCosmos) => T,
): T {
  return useBaseProjectBuilderStore<
    BaseProjectConfig & CosmosSliceConfig,
    ProjectStateWithCosmos,
    T
  >((state) => selector(state as ProjectStateWithCosmos));
}
