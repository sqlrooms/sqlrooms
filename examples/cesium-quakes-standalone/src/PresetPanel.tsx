/**
 * Subduction-zone preset panel.
 *
 * Clicking a preset:
 *   1. Flies the Cesium camera to the trench center at a pitched, along-strike
 *      orientation so the slab renders as a textbook Wadati–Benioff profile.
 *   2. Activates the earthquake slice's slab filter, which rewrites the layer
 *      SQL so only events within ±{sliceHalfWidthKm} km of the section line
 *      are rendered.
 */

import {FC, useCallback} from 'react';
import {
  BoundingSphere,
  Cartesian3,
  HeadingPitchRange,
  Math as CesiumMath,
} from 'cesium';
import {Button, Slider, cn} from '@sqlrooms/ui';
import {useStoreWithCesium} from './cesium';
import {RoomPanel} from '@sqlrooms/room-shell';
import {useRoomStore} from './store';
import type {SubductionPreset} from './earthquake-presets';
import {EarthquakePanels} from './panel-keys';

export const PresetPanel: FC = () => {
  const presets = useRoomStore((s) => s.earthquakes.presets);
  const activePresetId = useRoomStore((s) => s.earthquakes.activePresetId);
  const pendingSliceHalfWidthKm = useRoomStore(
    (s) => s.earthquakes.pendingSliceHalfWidthKm,
  );
  const activatePreset = useRoomStore((s) => s.earthquakes.activatePreset);
  const clearPreset = useRoomStore((s) => s.earthquakes.clearPreset);
  const setPendingSliceHalfWidthKm = useRoomStore(
    (s) => s.earthquakes.setPendingSliceHalfWidthKm,
  );
  const commitSliceWidth = useRoomStore((s) => s.earthquakes.commitSliceWidth);
  const viewer = useStoreWithCesium((s) => s.cesium.viewer);

  const flyToPreset = useCallback(
    (preset: SubductionPreset) => {
      // Update state first so the SQL slab filter applies even if the viewer
      // isn't mounted yet (HMR, slow terrain providers).
      activatePreset(preset.id);

      if (!viewer || viewer.isDestroyed()) return;

      // Aim the camera at a point roughly halfway down the slab so the full
      // Wadati–Benioff zone is in view. `flyToBoundingSphere` + HPR lets us
      // say "put the camera at heading H, pitch P, range R FROM this target"
      // instead of hand-computing a destination that happens to stare at the
      // right spot. The shallow-slab Cascadia/Hellenic presets still look
      // reasonable because range scales with slab depth (with a sensible
      // floor so we don't slam the camera into the ground).
      const slab = preset.slab;
      const slabDepthKm = slab?.maxDepthKm ?? 200;
      const target = Cartesian3.fromDegrees(
        preset.longitude,
        preset.latitude,
        -(slabDepthKm / 2) * 1000,
      );
      const rangeKm = Math.max(slabDepthKm * 2.2, 600);

      viewer.camera.flyToBoundingSphere(new BoundingSphere(target, 0), {
        offset: new HeadingPitchRange(
          CesiumMath.toRadians(preset.cameraHeadingDeg),
          CesiumMath.toRadians(preset.cameraPitchDeg),
          rangeKm * 1000,
        ),
        duration: 1.8,
      });
    },
    [activatePreset, viewer],
  );

  const handleClear = useCallback(() => {
    clearPreset();
    if (!viewer || viewer.isDestroyed()) return;
    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(0, 10, 18_000_000),
      orientation: {
        heading: 0,
        pitch: -CesiumMath.PI_OVER_TWO,
        roll: 0,
      },
      duration: 1.5,
    });
  }, [clearPreset, viewer]);

  return (
    <RoomPanel type={EarthquakePanels.Presets}>
      <div className="flex flex-col gap-3 px-3 pb-3 text-sm">
        <p className="text-muted-foreground text-xs leading-relaxed">
          Click a subduction zone to fly the camera to an along-strike view and
          slice the earthquake cloud perpendicular to the trench. What remains
          is the <em>Wadati–Benioff zone</em>: the descending slab traced by
          seismicity from the trench to ~700 km depth.
        </p>

        <div className="flex flex-col gap-2">
          {presets.map((preset) => {
            const isActive = preset.id === activePresetId;
            return (
              <Button
                key={preset.id}
                variant={isActive ? 'default' : 'outline'}
                size="sm"
                className={cn(
                  'h-auto flex-col items-start gap-1 py-2 text-left whitespace-normal',
                  isActive && 'ring-2 ring-offset-0',
                )}
                onClick={() => flyToPreset(preset)}
              >
                <span className="text-sm font-semibold">{preset.label}</span>
                <span
                  className={cn(
                    'text-xs leading-snug font-normal',
                    isActive
                      ? 'text-primary-foreground/90'
                      : 'text-muted-foreground',
                  )}
                >
                  {preset.description}
                </span>
              </Button>
            );
          })}
        </div>

        <div className="border-border/60 flex flex-col gap-2 border-t pt-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Slice width</span>
            <span className="font-mono">±{pendingSliceHalfWidthKm} km</span>
          </div>
          <Slider
            value={[pendingSliceHalfWidthKm]}
            min={10}
            max={200}
            step={5}
            // Drag updates the pending value (label only). The committed
            // value (and the SQL re-query) only changes on release —
            // otherwise dragging fires dozens of DuckDB queries.
            onValueChange={(vals) => {
              const v = vals[0];
              if (typeof v === 'number') setPendingSliceHalfWidthKm(v);
            }}
            onValueCommit={commitSliceWidth}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            disabled={!activePresetId}
          >
            Clear slice
          </Button>
        </div>
      </div>
    </RoomPanel>
  );
};
