/**
 * TypeScript type definitions for @sqlrooms/cesium package.
 * Defines state interfaces and action signatures for the Cesium slice.
 */

import type {
  Viewer as CesiumViewer,
  Entity,
  ClippingPlaneCollection,
} from 'cesium';
import type {
  CesiumSliceConfig,
  CameraPosition,
  ClockConfig,
  CesiumLayerConfig,
} from './cesium-config';

/**
 * Runtime (non-persisted) state for the Cesium viewer.
 * These values are transient and never saved to localStorage.
 */
export interface CesiumRuntimeState {
  /** The Cesium Viewer instance — set after mount, null before/after unmount */
  viewer: CesiumViewer | null;
  /** Whether the clock is currently animating */
  isAnimating: boolean;
  /** Currently selected entity (for highlighting/interaction) */
  selectedEntity: Entity | null;
  /** Loading state indicator for data sources */
  isLoadingData: boolean;
  /** Number of currently active entities per layer at the current clock time */
  layerEntityCounts: Record<string, number>;
}

/**
 * Combined Cesium slice state exposed under `state.cesium`.
 * Includes both persisted config and transient runtime state, plus all actions.
 */
export interface CesiumSliceState {
  cesium: {
    // Persisted configuration
    config: CesiumSliceConfig['cesium'];

    // Runtime state (transient)
    viewer: CesiumViewer | null;
    isAnimating: boolean;
    selectedEntity: Entity | null;
    isLoadingData: boolean;
    layerEntityCounts: Record<string, number>;

    // Viewer lifecycle actions
    /**
     * Store the Cesium viewer instance (called on mount).
     * @param viewer The Cesium viewer instance or null on unmount
     */
    setViewer: (viewer: CesiumViewer | null) => void;

    // Camera actions
    /**
     * Update camera position configuration (partial update).
     * @param camera Partial camera configuration to merge
     */
    setCameraPosition: (camera: Partial<CameraPosition>) => void;

    /**
     * Read current camera state from viewer and persist to config.
     * Call this on camera.moveEnd events to save user's camera position.
     */
    saveCameraPosition: () => void;

    /**
     * Fly camera to specific location.
     * @param longitude Target longitude in degrees
     * @param latitude Target latitude in degrees
     * @param height Optional height in meters (default: 1000000)
     */
    flyTo: (longitude: number, latitude: number, height?: number) => void;

    /**
     * Zoom camera to fit all entities in view.
     */
    zoomToFit: () => void;

    // Clock actions
    /**
     * Update clock configuration (partial update).
     * @param clock Partial clock configuration to merge
     */
    setClockConfig: (clock: Partial<ClockConfig>) => void;

    /**
     * Toggle animation play/pause state.
     */
    toggleAnimation: () => void;

    /**
     * Set current time in the clock.
     * @param isoString ISO 8601 formatted time string
     */
    setCurrentTime: (isoString: string) => void;

    // Layer management actions
    /**
     * Add a new layer to the configuration.
     * @param layer Layer configuration to add
     */
    addLayer: (layer: CesiumLayerConfig) => void;

    /**
     * Remove a layer by ID.
     * @param id Layer identifier to remove
     */
    removeLayer: (id: string) => void;

    /**
     * Update an existing layer configuration.
     * @param id Layer identifier to update
     * @param updates Partial layer configuration to merge
     */
    updateLayer: (id: string, updates: Partial<CesiumLayerConfig>) => void;

    /**
     * Toggle a layer's visibility on/off.
     * @param id Layer identifier to toggle
     */
    toggleLayerVisibility: (id: string) => void;

    // UI state actions
    /**
     * Set the currently selected entity.
     * @param entity Entity to select or null to clear selection
     */
    setSelectedEntity: (entity: Entity | null) => void;

    /**
     * Set the data loading state indicator.
     * @param loading Whether data is currently loading
     */
    setIsLoadingData: (loading: boolean) => void;

    /**
     * Set the currently active entity count for a given layer.
     * @param id Layer identifier
     * @param count Number of currently active entities
     */
    setLayerEntityCount: (id: string, count: number) => void;

    // Clipping plane actions
    /**
     * Enable a clipping plane on the globe for cross-section views.
     * The plane is defined by a normal direction and distance from the globe center.
     * @param normal Unit normal vector {x, y, z} in globe-fixed frame
     * @param distance Distance from origin along the normal (meters)
     */
    enableClippingPlane: (
      normal: {x: number; y: number; z: number},
      distance: number,
    ) => void;

    /**
     * Disable and remove the globe clipping plane.
     */
    disableClippingPlane: () => void;

    /**
     * Update the clipping plane distance (for interactive adjustment).
     * @param distance New distance from origin along the normal (meters)
     */
    setClippingPlaneDistance: (distance: number) => void;
  };
}

// Re-export Cesium types for convenience
export type {Viewer as CesiumViewer, Entity} from 'cesium';
