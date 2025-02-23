import {Graph} from '@cosmograph/cosmos';
import {createContext, useCallback, useContext, useState} from 'react';

/**
 * The shape of the context value provided by CosmosGraphContext.
 */
interface CosmosGraphContextValue {
  /** Whether the graph simulation is currently running */
  isSimulationRunning: boolean;
  /** Reference to the Cosmos Graph instance */
  graphRef: React.MutableRefObject<Graph | null> | null;
  /** Function to toggle the simulation state between running and paused */
  handleToggleSimulation: () => void;
  /** Function to fit the graph view to show all nodes */
  handleFitView: () => void;
  /** Function to start simulation with an energy push */
  handleStartWithEnergy: () => void;
}

/**
 * Context for sharing graph state and controls across components.
 * @internal
 */
const CosmosGraphContext = createContext<CosmosGraphContextValue | null>(null);

/**
 * Hook to access the CosmosGraph context.
 *
 * Provides access to:
 * - Graph simulation state
 * - Graph instance reference
 * - Control functions for simulation and view
 *
 * @example
 * ```tsx
 * const CustomControl = () => {
 *   const { isSimulationRunning, handleToggleSimulation } = useCosmosGraph();
 *
 *   return (
 *     <button onClick={handleToggleSimulation}>
 *       {isSimulationRunning ? 'Pause' : 'Start'}
 *     </button>
 *   );
 * };
 * ```
 *
 * @throws {Error} If used outside of a CosmosGraphProvider
 * @returns The graph context value
 */
export const useCosmosGraph = () => {
  const context = useContext(CosmosGraphContext);
  if (!context) {
    throw new Error('useCosmosGraph must be used within a CosmosGraphProvider');
  }
  return context;
};

/**
 * Props for the CosmosGraphProvider component.
 */
interface CosmosGraphProviderProps {
  /** Child components that will have access to the graph context */
  children: React.ReactNode;
  /** Reference to the Cosmos Graph instance */
  graphRef: React.MutableRefObject<Graph | null>;
}

/**
 * Provider component that makes graph state and controls available to its children.
 *
 * Manages:
 * - Simulation running state
 * - Graph instance reference
 * - Control functions for simulation and view
 *
 * @example
 * ```tsx
 * const MyGraph = () => {
 *   const graphRef = useRef<Graph | null>(null);
 *
 *   return (
 *     <CosmosGraphProvider graphRef={graphRef}>
 *       <CosmosGraph {...graphProps} />
 *       <CosmosGraphControls />
 *       <CustomControls />
 *     </CosmosGraphProvider>
 *   );
 * };
 * ```
 */
export const CosmosGraphProvider: React.FC<CosmosGraphProviderProps> = ({
  children,
  graphRef,
}) => {
  const [isSimulationRunning, setIsSimulationRunning] = useState(true);

  const handleStartWithEnergy = useCallback(() => {
    if (!graphRef.current) return;
    graphRef.current.start(1);
    setIsSimulationRunning(true);
  }, [graphRef]);

  const handleToggleSimulation = useCallback(() => {
    if (!graphRef.current) return;
    if (graphRef.current.isSimulationRunning) {
      graphRef.current.pause();
      setIsSimulationRunning(false);
    } else {
      graphRef.current.restart();
      setIsSimulationRunning(true);
    }
  }, [graphRef]);

  const handleFitView = useCallback(() => {
    if (!graphRef.current) return;
    graphRef.current.fitView();
  }, [graphRef]);

  return (
    <CosmosGraphContext.Provider
      value={{
        isSimulationRunning,
        graphRef,
        handleToggleSimulation,
        handleFitView,
        handleStartWithEnergy,
      }}
    >
      {children}
    </CosmosGraphContext.Provider>
  );
};
