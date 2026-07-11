/**
 * Inlined Cesium integration — barrel of hooks, components, slice actions,
 * and config types used by this standalone example.
 *
 * Originally carved out of a workspace package (@sqlrooms/cesium); kept as a
 * self-contained subfolder so the example demonstrates Cesium + sqlrooms
 * integration without taking on an additional package as a maintenance
 * burden for the monorepo.
 */

// ============================================================================
// Components
// ============================================================================

export {CesiumPanel} from './components/CesiumPanel';
export {CesiumViewerWrapper} from './components/CesiumViewerWrapper';
export {CesiumEntityLayer} from './components/CesiumEntityLayer';
export type {CesiumEntityLayerProps} from './components/CesiumEntityLayer';
export {CesiumToolbar} from './components/CesiumToolbar';
export type {CesiumToolbarProps} from './components/CesiumToolbar';
export {CesiumClock} from './components/CesiumClock';
export type {CesiumClockProps} from './components/CesiumClock';

// ============================================================================
// State Management
// ============================================================================

export {createCesiumSlice, useStoreWithCesium} from './cesium-slice';
export type {RoomStateWithCesium} from './cesium-slice';
export type {CesiumSliceState, CesiumRuntimeState} from './cesium-types';

// ============================================================================
// Configuration
// ============================================================================

export {
  CesiumSliceConfig,
  CameraPosition,
  ClockConfig,
  ColumnMapping,
  CesiumLayerConfig,
  createDefaultCesiumConfig,
} from './cesium-config';

// Export types inferred from Zod schemas
export type {
  CesiumSliceConfig as CesiumSliceConfigType,
  CameraPosition as CameraPositionType,
  ClockConfig as ClockConfigType,
  ColumnMapping as ColumnMappingType,
  CesiumLayerConfig as CesiumLayerConfigType,
} from './cesium-config';

// ============================================================================
// Hooks
// ============================================================================

export {useCesiumViewer} from './hooks/useCesiumViewer';
export {useSqlToCesiumEntities} from './hooks/useSqlToCesiumEntities';
export type {CesiumEntityDescriptor} from './hooks/useSqlToCesiumEntities';
export {useClockSync} from './hooks/useClockSync';

// ============================================================================
// Re-exports from Cesium (for convenience)
// ============================================================================

export type {Viewer as CesiumViewer, Entity} from 'cesium';
