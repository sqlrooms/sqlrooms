/**
 * {@include ../README.md}
 * @packageDocumentation
 */

// Components
export {CosmosGraph} from './CosmosGraph';
export type {CosmosGraphProps} from './CosmosGraph';
export {CosmosGraphControls} from './CosmosGraphControls';

/**
 * A component that provides fine-grained controls for the graph simulation parameters.
 */
export {CosmosSimulationControls} from './CosmosSimulationControls';

// State management
export {useHoverState} from './hooks/useHoverState';
export type {HoverState} from './hooks/useHoverState';
export {createCosmosSlice, useStoreWithCosmos} from './CosmosSlice';
export type {CosmosSliceState, RoomStateWithCosmos} from './CosmosSlice';

// Configuration
// Values also export their corresponding types automatically (Zod pattern)
export {
  CosmosSliceConfig,
  createDefaultCosmosConfig,
} from './CosmosSliceConfig';
