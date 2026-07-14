/**
 * Non-visual controller that enables a Cesium globe clipping plane whenever a
 * subduction-zone preset is active. The plane is oriented along the trench
 * strike and passes through the preset center, so the camera looks at a clean
 * cross-section of the Earth's interior with the dipping slab and seismicity
 * silhouetted against the cut surface.
 */

import {useEffect} from 'react';
import {useStoreWithCesium} from './cesium';
import {useRoomStore} from './store';
import {
  SUBDUCTION_PRESETS,
  computePresetClippingPlane,
} from './earthquake-presets';

export function SliceClippingController() {
  const viewer = useStoreWithCesium((s) => s.cesium.viewer);
  const enableClippingPlane = useStoreWithCesium(
    (s) => s.cesium.enableClippingPlane,
  );
  const disableClippingPlane = useStoreWithCesium(
    (s) => s.cesium.disableClippingPlane,
  );
  const activePresetId = useRoomStore((s) => s.earthquakes.activePresetId);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;
    if (!activePresetId) {
      disableClippingPlane();
      return;
    }

    const preset = SUBDUCTION_PRESETS.find((p) => p.id === activePresetId);
    if (!preset) return;

    const {normal, distance} = computePresetClippingPlane(preset);
    enableClippingPlane(normal, distance);

    return () => {
      if (!viewer.isDestroyed()) {
        disableClippingPlane();
      }
    };
  }, [viewer, activePresetId, enableClippingPlane, disableClippingPlane]);

  return null;
}
