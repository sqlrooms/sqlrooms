/**
 * @sqlrooms/cosmos - A React wrapper for the Cosmograph visualization library
 *
 * This package provides React components and hooks for creating interactive graph visualizations
 * using the Cosmograph WebGL-based graph visualization library. It includes components for
 * rendering graphs, managing graph state through zustand, and controlling graph interactions.
 *
 * @example Basic usage
 * ```tsx
 * import { CosmosGraph, CosmosGraphControls } from '@sqlrooms/cosmos';
 *
 * const MyGraph = () => {
 *   return (
 *     <div style={{ width: '800px', height: '600px' }}>
 *       <CosmosGraph
 *         config={graphConfig}
 *         pointPositions={positions}
 *         pointColors={colors}
 *         pointSizes={sizes}
 *       >
 *         <CosmosGraphControls />
 *       </CosmosGraph>
 *     </div>
 *   );
 * };
 * ```
 *
 * @packageDocumentation
 */

// Components
export {CosmosGraph} from './CosmosGraph';
export {CosmosGraphControls} from './CosmosGraphControls';

/**
 * A component that provides fine-grained controls for the graph simulation parameters.
 * Uses the zustand store to access and control the graph state.
 *
 * Features:
 * - Slider controls for gravity, repulsion, link strength, link distance, friction, and decay
 * - Real-time parameter adjustment with immediate visual feedback
 * - Tooltips with parameter descriptions
 * - Customizable positioning
 *
 * @example Basic usage
 * ```tsx
 * <CosmosGraph {...graphProps}>
 *   <CosmosSimulationControls />
 * </CosmosGraph>
 * ```
 *
 * @example Custom positioning
 * ```tsx
 * <CosmosGraph {...graphProps}>
 *   <CosmosSimulationControls className="absolute bottom-4 left-4" />
 * </CosmosGraph>
 * ```
 */
export {CosmosSimulationControls} from './CosmosSimulationControls';
export type {CosmosGraphProps} from './CosmosGraph';

// State management
export {useHoverState} from './hooks/useHoverState';
export {
  createCosmosSlice,
  useStoreWithCosmos,
  type CosmosSliceState,
  type ProjectStateWithCosmos,
} from './CosmosSlice';
export {
  CosmosSliceConfig,
  createDefaultCosmosConfig,
  type CosmosSliceConfig as CosmosSliceConfigType,
} from './CosmosSliceConfig';

// Utilities
export type {WithClientCoordinates} from './utils/coordinates';
export {hasClientCoordinates} from './utils/coordinates';

// Configuration
/**
 * Zod schema for validating and describing graph simulation configuration parameters.
 *
 * Available parameters:
 * - `simulationGravity` (number): Gravity force in the simulation. Controls how strongly nodes are pulled toward the center.
 * - `simulationRepulsion` (number): Repulsion force between nodes. Higher values make nodes push away from each other more strongly.
 * - `simulationLinkSpring` (number): Spring force for links between nodes. Higher values make connected nodes pull together more strongly.
 * - `simulationLinkDistance` (number): Target distance between linked nodes. Defines the natural length of links in the simulation.
 * - `simulationFriction` (number): Friction coefficient in the simulation. Higher values make node movement more damped.
 * - `simulationDecay` (number): Decay coefficient in the simulation. Lower values make the simulation "cool down" more slowly.
 *
 * @example
 * ```tsx
 * import { CosmosSimulationConfigSchema } from '@sqlrooms/cosmos';
 *
 * const config = {
 *   simulationGravity: 0.1,
 *   simulationRepulsion: 1.0,
 *   simulationLinkSpring: 1.0,
 *   simulationLinkDistance: 10,
 *   simulationFriction: 0.85,
 *   simulationDecay: 1000
 * };
 *
 * // Validate the config
 * const validConfig = CosmosSimulationConfigSchema.parse(config);
 * ```
 */
export {CosmosSimulationConfigSchema} from './config';
