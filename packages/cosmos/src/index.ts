/**
 * @sqlrooms/cosmos - A React wrapper for the Cosmograph visualization library
 *
 * This package provides React components and hooks for creating interactive graph visualizations
 * using the Cosmograph WebGL-based graph visualization library. It includes components for
 * rendering graphs, managing graph state, and controlling graph interactions.
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
export type {CosmosGraphProps} from './CosmosGraph';

// Context and hooks
export {useCosmosGraph} from './CosmosGraphContext';
export {useGraph, useHoverState, useGraphConfig} from './hooks';
export type {HoverState} from './hooks/useHoverState';

// Utilities
export type {WithClientCoordinates} from './utils/coordinates';
export {hasClientCoordinates} from './utils/coordinates';
