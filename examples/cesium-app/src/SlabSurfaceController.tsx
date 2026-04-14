/**
 * Non-visual controller that mounts a translucent slab surface in the Cesium
 * scene whenever a subduction-zone preset is active. Uses the imperative
 * Cesium primitive API rather than Resium <Entity> components because we
 * need a single triangle mesh, not per-row entities.
 */

import {useEffect} from 'react';
import {useStoreWithCesium} from '@sqlrooms/cesium';
import {useRoomStore} from './store';
import {SUBDUCTION_PRESETS} from './earthquake-presets';
import {buildSlabPrimitive} from './slab-mesh';

export function SlabSurfaceController() {
  const viewer = useStoreWithCesium((s) => s.cesium.viewer);
  const activePresetId = useRoomStore((s) => s.earthquakes.activePresetId);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed() || !activePresetId) return;

    const preset = SUBDUCTION_PRESETS.find((p) => p.id === activePresetId);
    if (!preset) return;

    const primitive = buildSlabPrimitive(preset);
    if (!primitive) return;

    viewer.scene.primitives.add(primitive);

    return () => {
      // viewer.scene.primitives has destroyPrimitives = true by default,
      // so remove() also frees the GPU buffers.
      if (!viewer.isDestroyed()) {
        viewer.scene.primitives.remove(primitive);
      }
    };
  }, [viewer, activePresetId]);

  return null;
}
