import {Graph, GraphConfigInterface} from '@cosmograph/cosmos';
import {
  createSlice,
  useBaseProjectStore,
  type ProjectState,
} from '@sqlrooms/project-builder';
import type {BaseProjectConfig} from '@sqlrooms/project-config';
import type {StateCreator} from 'zustand';
import {CosmosSliceConfig} from './CosmosSliceConfig';
import type {z} from 'zod';
import {CosmosSimulationConfigSchema} from './config';

export type CosmosSliceState = {
  cosmos: {
    graph: Graph | null;
    isSimulationRunning: boolean;
    simulationConfig: z.infer<typeof CosmosSimulationConfigSchema>;
    graphConfig: GraphConfigInterface;
    createGraph: (container: HTMLDivElement) => void;
    toggleSimulation: () => void;
    fitView: () => void;
    startWithEnergy: () => void;
    destroyGraph: () => void;
    updateSimulationConfig: (
      config: Partial<z.infer<typeof CosmosSimulationConfigSchema>>,
    ) => void;
    updateGraphConfig: (config: Partial<GraphConfigInterface>) => void;
    updateGraphData: (data: {
      pointPositions?: Float32Array;
      pointColors?: Float32Array;
      pointSizes?: Float32Array;
      linkIndexes?: Float32Array;
      linkColors?: Float32Array;
    }) => void;
    setFocusedPoint: (index: number | undefined) => void;
    setZoomLevel: (level: number) => void;
  };
};

export type ProjectStateWithCosmos = ProjectState<
  BaseProjectConfig & CosmosSliceConfig
> &
  CosmosSliceState;

export function createCosmosSlice(): StateCreator<CosmosSliceState> {
  return createSlice<BaseProjectConfig & CosmosSliceConfig, CosmosSliceState>(
    (set, get) => ({
      cosmos: {
        graph: null,
        isSimulationRunning: true,
        simulationConfig: {
          simulationGravity: 0.25,
          simulationRepulsion: 1.0,
          simulationLinkSpring: 1.0,
          simulationLinkDistance: 10,
          simulationFriction: 0.85,
          simulationDecay: 1000,
        },
        graphConfig: {
          backgroundColor: '#ffffff',
          simulationGravity: 0.25,
          simulationRepulsion: 1.0,
          simulationLinkSpring: 1.0,
          simulationLinkDistance: 10,
          simulationFriction: 0.85,
          simulationDecay: 1000,
        },

        createGraph: (container: HTMLDivElement) => {
          // Clean up old graph if it exists
          const oldGraph = get().cosmos.graph;
          if (oldGraph) {
            oldGraph.pause();
            oldGraph.destroy();
          }

          // Create and configure new graph
          const graph = new Graph(container);
          const {graphConfig} = get().cosmos;
          graph.setConfig(graphConfig);
          graph.start();

          set((state: CosmosSliceState) => ({
            cosmos: {
              ...state.cosmos,
              graph,
            },
          }));
        },

        toggleSimulation: () => {
          const {graph} = get().cosmos;
          if (!graph) return;

          if (graph.isSimulationRunning) {
            graph.pause();
            set((state: CosmosSliceState) => ({
              cosmos: {
                ...state.cosmos,
                isSimulationRunning: false,
              },
            }));
          } else {
            graph.restart();
            set((state: CosmosSliceState) => ({
              cosmos: {
                ...state.cosmos,
                isSimulationRunning: true,
              },
            }));
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
          set((state: CosmosSliceState) => ({
            cosmos: {
              ...state.cosmos,
              isSimulationRunning: true,
            },
          }));
        },

        updateSimulationConfig: (
          config: Partial<z.infer<typeof CosmosSimulationConfigSchema>>,
        ) => {
          const {graph, graphConfig} = get().cosmos;
          const newSimConfig = {
            ...get().cosmos.simulationConfig,
            ...config,
          };

          const newGraphConfig = {
            ...graphConfig,
            ...newSimConfig,
          };

          if (graph) {
            graph.setConfig(newGraphConfig);
          }

          set((state: CosmosSliceState) => ({
            cosmos: {
              ...state.cosmos,
              simulationConfig: newSimConfig,
              graphConfig: newGraphConfig,
            },
          }));
        },

        updateGraphConfig: (config: Partial<GraphConfigInterface>) => {
          const {graph, simulationConfig} = get().cosmos;
          const newConfig = {
            ...get().cosmos.graphConfig,
            ...config,
            ...simulationConfig,
          };

          if (graph) {
            graph.setConfig(newConfig);
          }

          set((state: CosmosSliceState) => ({
            cosmos: {
              ...state.cosmos,
              graphConfig: newConfig,
            },
          }));
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
          set((state: CosmosSliceState) => ({
            cosmos: {
              ...state.cosmos,
              graph: null,
              isSimulationRunning: false,
            },
          }));
        },
      },
    }),
  );
}

export function useStoreWithCosmos<T>(
  selector: (state: ProjectStateWithCosmos) => T,
): T {
  return useBaseProjectStore<
    BaseProjectConfig & CosmosSliceConfig,
    ProjectStateWithCosmos,
    T
  >((state) => selector(state as ProjectStateWithCosmos));
}
