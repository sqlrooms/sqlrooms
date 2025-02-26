/**
 * {@include ../README.md}
 * @packageDocumentation
 */

// Components
export {CosmosGraph} from './CosmosGraph';
export {CosmosGraphControls} from './CosmosGraphControls';

/**
 * A component that provides fine-grained controls for the graph simulation parameters.
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
export * from './CosmosSliceConfig';
