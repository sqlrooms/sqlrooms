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

// Configuration
/**
 * Configuration schema for the Cosmos graph visualization system.
 * Provides type-safe validation and configuration options for both visual and physics aspects of the graph.
 *
 * Configuration Categories:
 *
 * 1. Visual Appearance
 * - Node styling: size scaling and zoom behavior
 * - Link styling: visibility, width, arrows, and curve options
 *
 * 2. Physics Simulation
 * - Gravity: Central force pulling nodes toward center
 * - Repulsion: Force pushing nodes apart
 * - Link Forces: Spring forces and distances between connected nodes
 * - Dynamics: Friction and decay rates for movement
 *
 * Key Parameters:
 * - `pointSizeScale` (number): Base scale for node sizes (default: 1.1)
 * - `scalePointsOnZoom` (boolean): Dynamic node sizing with zoom (default: true)
 * - `renderLinks` (boolean): Toggle link visibility (default: true)
 * - `linkArrows` (boolean): Show directional arrows (default: false)
 * - `curvedLinks` (boolean): Use curved or straight links (default: false)
 * - `simulationGravity` (number): Center attraction strength (default: 0.25)
 * - `simulationRepulsion` (number): Node repulsion strength (default: 1.0)
 * - `simulationLinkSpring` (number): Link elasticity (default: 1.0)
 * - `simulationFriction` (number): Movement damping (default: 0.85)
 * - `simulationDecay` (number): Simulation cooling rate (default: 1000)
 *
 * @example Typical usage with default-like values
 * ```tsx
 * import { CosmosGraph, createDefaultCosmosConfig } from '@sqlrooms/cosmos';
 *
 * const config = createDefaultCosmosConfig();
 *
 * function MyGraph() {
 *   return (
 *     <CosmosGraph
 *       config={config}
 *       data={graphData}
 *     />
 *   );
 * }
 * ```
 *
 * @example Custom configuration for directed graph
 * ```tsx
 * const config = {
 *   cosmos: {
 *     // Visual settings
 *     pointSizeScale: 1.2,
 *     linkArrows: true,
 *     curvedLinks: true,
 *
 *     // Physics settings
 *     simulationGravity: 0.2,
 *     simulationLinkDistance: 15,
 *     simulationLinkSpring: 1.2
 *   }
 * };
 * ```
 *
 * @see {@link CosmosGraph} For the main graph component
 * @see {@link CosmosSimulationControls} For runtime control of simulation parameters
 */
export * from './CosmosSliceConfig';
