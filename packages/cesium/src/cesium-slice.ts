/**
 * Zustand slice for Cesium 3D globe visualization state management.
 * Follows the SQLRooms slice pattern with config/runtime separation.
 */

import {
  createSlice,
  useBaseRoomShellStore,
  type RoomShellSliceState,
} from '@sqlrooms/room-shell';
import {produce} from 'immer';
import type {StateCreator} from 'zustand';
import type {Viewer as CesiumViewer, Cartographic} from 'cesium';
import {
  Math as CesiumMath,
  Cartesian3,
  ClippingPlane,
  ClippingPlaneCollection,
} from 'cesium';
import {
  type CesiumSliceConfig,
  type CameraPosition,
  type ClockConfig,
  type CesiumLayerConfig,
  createDefaultCesiumConfig,
} from './cesium-config';
import type {CesiumSliceState} from './cesium-types';

/**
 * Creates the Cesium Zustand slice.
 * Manages viewer lifecycle, camera state, clock animation, and layer configuration.
 *
 * Pattern from cosmos: State creator function accepts (set, get) from Zustand,
 * returns state object with config (persistent) and runtime state (transient).
 *
 * @param initialConfig Optional initial configuration
 * @returns StateCreator function compatible with createRoomStore
 *
 * @example
 * ```typescript
 * const store = createRoomStore<RoomState>((set, get, store) => ({
 *   ...createRoomShellSlice({...})(set, get, store),
 *   ...createCesiumSlice()(set, get, store),
 * }));
 * ```
 */
export function createCesiumSlice(
  initialConfig?: CesiumSliceConfig,
): StateCreator<CesiumSliceState> {
  const config = initialConfig?.cesium ?? createDefaultCesiumConfig().cesium;

  return createSlice<CesiumSliceState>((set, get) => ({
    cesium: {
      // Persistent configuration
      config,

      // Runtime state (transient, never persisted)
      viewer: null,
      isAnimating: config.clock.shouldAnimate,
      selectedEntity: null,
      isLoadingData: false,
      layerEntityCounts: {},

      // Viewer lifecycle actions
      setViewer: (viewer: CesiumViewer | null) =>
        set((state) => ({
          cesium: {...state.cesium, viewer},
        })),

      // Camera actions
      setCameraPosition: (camera: Partial<CameraPosition>) =>
        set((state) =>
          produce(state, (draft) => {
            draft.cesium.config.camera = {
              ...draft.cesium.config.camera,
              ...camera,
            };
          }),
        ),

      saveCameraPosition: () => {
        const viewer = get().cesium.viewer;
        if (!viewer) return;

        const camera = viewer.camera;
        const carto: Cartographic = camera.positionCartographic;

        set((state) =>
          produce(state, (draft) => {
            draft.cesium.config.camera = {
              longitude: CesiumMath.toDegrees(carto.longitude),
              latitude: CesiumMath.toDegrees(carto.latitude),
              height: carto.height,
              heading: camera.heading,
              pitch: camera.pitch,
              roll: camera.roll,
            };
          }),
        );
      },

      flyTo: (longitude: number, latitude: number, height = 1000000) => {
        const viewer = get().cesium.viewer;
        if (!viewer) return;

        viewer.camera.flyTo({
          destination: Cartesian3.fromDegrees(longitude, latitude, height),
        });
      },

      zoomToFit: () => {
        const viewer = get().cesium.viewer;
        if (!viewer) return;
        viewer.zoomTo(viewer.entities).then(() => {
          // Clamp max altitude so zoom-to-fit doesn't fly to space
          // (e.g. when a clipping plane hides most of the globe)
          const carto = viewer.camera.positionCartographic;
          const MAX_HEIGHT = 5_000_000; // ~5000 km
          if (carto.height > MAX_HEIGHT) {
            viewer.camera.setView({
              destination: Cartesian3.fromRadians(
                carto.longitude,
                carto.latitude,
                MAX_HEIGHT,
              ),
            });
          }
        });
      },

      // Clock actions
      setClockConfig: (clock: Partial<ClockConfig>) =>
        set((state) =>
          produce(state, (draft) => {
            draft.cesium.config.clock = {
              ...draft.cesium.config.clock,
              ...clock,
            };
          }),
        ),

      toggleAnimation: () =>
        set((state) =>
          produce(state, (draft) => {
            const nextAnimating = !draft.cesium.isAnimating;
            draft.cesium.isAnimating = nextAnimating;
            // Also persist to config so it survives reload
            draft.cesium.config.clock.shouldAnimate = nextAnimating;
          }),
        ),

      setCurrentTime: (isoString: string) =>
        set((state) =>
          produce(state, (draft) => {
            draft.cesium.config.clock.currentTime = isoString;
          }),
        ),

      // Layer management actions
      addLayer: (layer: CesiumLayerConfig) =>
        set((state) =>
          produce(state, (draft) => {
            draft.cesium.config.layers.push(layer);
          }),
        ),

      removeLayer: (id: string) =>
        set((state) =>
          produce(state, (draft) => {
            draft.cesium.config.layers = draft.cesium.config.layers.filter(
              (l) => l.id !== id,
            );
          }),
        ),

      updateLayer: (id: string, updates: Partial<CesiumLayerConfig>) =>
        set((state) =>
          produce(state, (draft) => {
            const layer = draft.cesium.config.layers.find((l) => l.id === id);
            if (layer) {
              Object.assign(layer, updates);
            }
          }),
        ),

      toggleLayerVisibility: (id: string) =>
        set((state) =>
          produce(state, (draft) => {
            const layer = draft.cesium.config.layers.find((l) => l.id === id);
            if (layer) {
              layer.visible = !layer.visible;
            }
          }),
        ),

      // UI state actions
      setSelectedEntity: (entity) =>
        set((state) => ({
          cesium: {...state.cesium, selectedEntity: entity},
        })),

      setIsLoadingData: (loading: boolean) =>
        set((state) => ({
          cesium: {...state.cesium, isLoadingData: loading},
        })),

      setLayerEntityCount: (id: string, count: number) =>
        set((state) => ({
          cesium: {
            ...state.cesium,
            layerEntityCounts: {
              ...state.cesium.layerEntityCounts,
              [id]: count,
            },
          },
        })),

      // Clipping plane actions
      enableClippingPlane: (
        normal: {x: number; y: number; z: number},
        distance: number,
      ) => {
        const viewer = get().cesium.viewer;
        if (!viewer || viewer.isDestroyed()) return;

        const globe = viewer.scene.globe;

        // Remove existing planes first
        if (globe.clippingPlanes) {
          globe.clippingPlanes.destroy();
          globe.clippingPlanes = undefined as any;
        }

        // Create with enabled=false first, attach to globe, then enable
        // after one render pass. This avoids the "Expected width > 0"
        // error from ClippingPlaneCollection.update racing with
        // ContextLimits initialization.
        const collection = new ClippingPlaneCollection({
          planes: [
            new ClippingPlane(
              new Cartesian3(normal.x, normal.y, normal.z),
              distance,
            ),
          ],
          edgeWidth: 2.0,
          enabled: false,
        });
        globe.clippingPlanes = collection;

        // Enable after one render frame to let the GL context finish setup
        const removeListener = viewer.scene.postRender.addEventListener(() => {
          removeListener();
          if (!viewer.isDestroyed() && collection) {
            collection.enabled = true;
          }
        });
      },

      disableClippingPlane: () => {
        const viewer = get().cesium.viewer;
        if (!viewer || viewer.isDestroyed()) return;

        const globe = viewer.scene.globe;
        if (globe.clippingPlanes) {
          globe.clippingPlanes.destroy();
          globe.clippingPlanes = undefined as any;
        }
      },

      setClippingPlaneDistance: (distance: number) => {
        const viewer = get().cesium.viewer;
        if (!viewer) return;

        const planes = viewer.scene.globe.clippingPlanes;
        if (planes && planes.length > 0) {
          planes.get(0).distance = distance;
        }
      },
    },
  }));
}

/**
 * Combined room state type with Cesium slice.
 * Use this when creating a room store that includes Cesium.
 */
export type RoomStateWithCesium = RoomShellSliceState & CesiumSliceState;

/**
 * Type-safe hook for accessing Cesium state from the room store.
 * Provides proper typing for components using Cesium slice.
 *
 * @param selector State selector function
 * @returns Selected state value
 *
 * @example
 * ```typescript
 * const viewer = useStoreWithCesium(s => s.cesium.viewer);
 * const layers = useStoreWithCesium(s => s.cesium.config.layers);
 * ```
 */
export function useStoreWithCesium<T>(
  selector: (state: RoomStateWithCesium) => T,
): T {
  return useBaseRoomShellStore<RoomStateWithCesium, T>((state) =>
    selector(state as RoomStateWithCesium),
  );
}
