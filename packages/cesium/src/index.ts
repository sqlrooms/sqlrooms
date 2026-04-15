/**
 * @sqlrooms/cesium - Cesium 3D globe visualization for SQLRooms
 *
 * Provides time-dynamic 3D geospatial visualization powered by CesiumJS.
 * Integrates with DuckDB for SQL-based data queries and supports
 * camera persistence, clock animation, and layer management.
 *
 * @packageDocumentation
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
