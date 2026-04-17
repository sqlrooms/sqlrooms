/**
 * Non-visual controller that mounts a translucent slab surface in the Cesium
 * scene whenever a subduction-zone preset is active. Uses the imperative
 * Cesium primitive API rather than Resium <Entity> components because we
 * need a single triangle mesh, not per-row entities.
 *
 * The slab primitive is clipped by two opposing planes so the mesh only
 * renders within ±`sliceHalfWidthKm` of the section line — it reads as a
 * thin section ribbon of the subducting plate rather than a globe-spanning
 * sheet.
 */

import {useEffect} from 'react';
import {Cartesian3, ClippingPlane, ClippingPlaneCollection} from 'cesium';
import {useStoreWithCesium} from '@sqlrooms/cesium';
import {useRoomStore} from './store';
import {
  SUBDUCTION_PRESETS,
  computeSlabClippingPlanes,
  DEFAULT_SLICE_HALF_WIDTH_KM,
} from './earthquake-presets';
import {buildSlabPrimitive} from './slab-mesh';

export function SlabSurfaceController() {
  const viewer = useStoreWithCesium((s) => s.cesium.viewer);
  const activePresetId = useRoomStore((s) => s.earthquakes.activePresetId);
  const sliceHalfWidthKm = useRoomStore((s) => s.earthquakes.sliceHalfWidthKm);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed() || !activePresetId) return;

    const preset = SUBDUCTION_PRESETS.find((p) => p.id === activePresetId);
    if (!preset) return;

    const primitive = buildSlabPrimitive(preset);
    if (!primitive) return;

    // Two-plane slab clip: keeps only the ±halfWidth strip of the slab
    // surface that sits in the section window.
    //
    // `unionClippingRegions: true` means a point is clipped if it's on the
    // OUTSIDE of ANY plane — equivalent to keeping the intersection of each
    // plane's "inside" half-space, which is the slab between the two planes.
    // (Cesium's TS types don't expose `clippingPlanes` on Primitive even
    // though it's a documented runtime field — cast through any.)
    const halfWidthKm =
      preset.sliceHalfWidthKm ??
      sliceHalfWidthKm ??
      DEFAULT_SLICE_HALF_WIDTH_KM;
    const planes = computeSlabClippingPlanes(preset, halfWidthKm);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (primitive as any).clippingPlanes = new ClippingPlaneCollection({
      planes: planes.map(
        (p) =>
          new ClippingPlane(
            new Cartesian3(p.normal.x, p.normal.y, p.normal.z),
            p.distance,
          ),
      ),
      unionClippingRegions: true,
      edgeWidth: 2.0,
    });

    viewer.scene.primitives.add(primitive);

    return () => {
      // viewer.scene.primitives has destroyPrimitives = true by default,
      // so remove() also frees the GPU buffers (including the CPC above).
      if (!viewer.isDestroyed()) {
        viewer.scene.primitives.remove(primitive);
      }
    };
  }, [viewer, activePresetId, sliceHalfWidthKm]);

  return null;
}
