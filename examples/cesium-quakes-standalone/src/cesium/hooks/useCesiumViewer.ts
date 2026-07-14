/**
 * Utility hook for accessing the Cesium viewer instance from the store.
 */

import type {Viewer as CesiumViewer} from 'cesium';
import {useStoreWithCesium} from '../cesium-slice';

/**
 * Hook to access the Cesium viewer instance from the room store.
 * Returns null if viewer is not yet mounted.
 *
 * @returns Cesium viewer instance or null
 *
 * @example
 * ```typescript
 * const viewer = useCesiumViewer();
 * if (viewer) {
 *   viewer.camera.flyTo({...});
 * }
 * ```
 */
export function useCesiumViewer(): CesiumViewer | null {
  return useStoreWithCesium((s) => s.cesium.viewer);
}
