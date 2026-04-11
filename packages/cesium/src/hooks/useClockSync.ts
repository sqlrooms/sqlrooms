/**
 * Bidirectional clock synchronization hook for Cesium and Zustand.
 * Handles throttled updates from Cesium clock to store and config changes from store to Cesium.
 */

import {useEffect, useRef} from 'react';
import {JulianDate, ClockRange, type Clock, type Viewer} from 'cesium';
import {useStoreWithCesium} from '../cesium-slice';
import type {ClockConfig} from '../cesium-config';
import {toIso8601} from '../utils';

// Map config enum strings to Cesium ClockRange constants
const CLOCK_RANGE_MAP = {
  UNBOUNDED: ClockRange.UNBOUNDED,
  CLAMPED: ClockRange.CLAMPED,
  LOOP_STOP: ClockRange.LOOP_STOP,
} as const;

/**
 * Imperatively apply clock config to Cesium viewer.
 * Extracted as a module-level function to avoid React Compiler immutability tracking.
 */
function applyClockConfigToViewer(viewer: Viewer, config: ClockConfig): void {
  const clock = viewer.clock;

  if (config.startTime) {
    try {
      clock.startTime = JulianDate.fromIso8601(toIso8601(config.startTime));
    } catch {
      /* skip invalid date */
    }
  }
  if (config.stopTime) {
    try {
      clock.stopTime = JulianDate.fromIso8601(toIso8601(config.stopTime));
    } catch {
      /* skip invalid date */
    }
  }
  if (config.currentTime) {
    try {
      clock.currentTime = JulianDate.fromIso8601(toIso8601(config.currentTime));
    } catch {
      /* skip invalid date */
    }
  }

  clock.multiplier = config.multiplier;
  clock.shouldAnimate = config.shouldAnimate;
  clock.clockRange = CLOCK_RANGE_MAP[config.clockRange];
}

/**
 * Synchronizes Cesium's clock with Zustand state bidirectionally.
 *
 * - **Cesium → Store**: Listens to clock.onTick events and updates store's currentTime
 *   (throttled to 500ms to avoid flooding store with 60fps updates)
 *
 * - **Store → Cesium**: Listens to config changes and applies them to the viewer's clock
 *   (startTime, stopTime, multiplier, shouldAnimate)
 *
 * **Why throttle?** Cesium's clock ticks at 60fps. Writing to Zustand every frame would:
 * - Destroy performance (60 store updates/second)
 * - Cause excessive React re-renders
 * - Flood Redux DevTools with actions
 *
 * The Cesium clock remains the source of truth for smooth 60fps animation.
 * The store mirrors state for UI controls and persistence.
 *
 * @example
 * ```typescript
 * // In CesiumViewerWrapper component
 * export const CesiumViewerWrapper = () => {
 *   // ... viewer setup
 *   useClockSync(); // Activate bidirectional sync
 *   return <Viewer>...</Viewer>;
 * };
 * ```
 */
export function useClockSync(): void {
  const viewer = useStoreWithCesium((s) => s.cesium.viewer);
  const clockConfig = useStoreWithCesium((s) => s.cesium.config.clock);
  const setCurrentTime = useStoreWithCesium((s) => s.cesium.setCurrentTime);
  const lastSyncRef = useRef(0);

  // Cesium → Store: Throttled clock tick listener
  useEffect(() => {
    if (!viewer) return;
    const v = viewer;

    const onTick = (clock: Clock) => {
      const now = Date.now();
      // Throttle to max 2 updates/second (500ms interval)
      if (now - lastSyncRef.current < 500) return;

      lastSyncRef.current = now;
      // Convert JulianDate to ISO 8601 string for storage
      setCurrentTime(JulianDate.toIso8601(clock.currentTime));
    };

    v.clock.onTick.addEventListener(onTick);

    return () => {
      // Guard against destroyed viewer on unmount
      if (!v.isDestroyed()) {
        v.clock.onTick.removeEventListener(onTick);
      }
    };
  }, [viewer, setCurrentTime]);

  // Store → Cesium: Apply config changes to viewer clock
  useEffect(() => {
    if (!viewer) return;
    applyClockConfigToViewer(viewer, clockConfig);
  }, [viewer, clockConfig]);

  // Timeline zoom: only update when startTime/stopTime change (not on every currentTime tick)
  const startTime = useStoreWithCesium((s) => s.cesium.config.clock.startTime);
  const stopTime = useStoreWithCesium((s) => s.cesium.config.clock.stopTime);

  useEffect(() => {
    if (!viewer || !startTime || !stopTime || !viewer.timeline) return;
    try {
      const startJd = JulianDate.fromIso8601(toIso8601(startTime));
      const stopJd = JulianDate.fromIso8601(toIso8601(stopTime));
      viewer.timeline.zoomTo(startJd, stopJd);
    } catch {
      /* skip invalid dates */
    }
  }, [viewer, startTime, stopTime]);
}
