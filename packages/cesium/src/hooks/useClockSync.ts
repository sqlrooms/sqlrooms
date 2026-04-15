/**
 * Bidirectional clock synchronization hook for Cesium and Zustand.
 * Handles throttled updates from Cesium clock to store and config changes from store to Cesium.
 */

import {useEffect, useRef} from 'react';
import {useShallow} from 'zustand/react/shallow';
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
 * Imperatively apply clock config/time to Cesium viewer.
 * Extracted as module-level functions to avoid React Compiler immutability tracking.
 */
function applyCurrentTimeToViewer(viewer: Viewer, isoTime: string): void {
  try {
    viewer.clock.currentTime = JulianDate.fromIso8601(toIso8601(isoTime));
  } catch {
    /* skip invalid date */
  }
}

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
  // Select only store→Cesium inputs. Excluding currentTime prevents a feedback
  // loop: the tick handler writes currentTime to the store, which would
  // otherwise retrigger this effect and overwrite Cesium's live clock.
  const clockInputs = useStoreWithCesium(
    useShallow((s) => ({
      startTime: s.cesium.config.clock.startTime,
      stopTime: s.cesium.config.clock.stopTime,
      multiplier: s.cesium.config.clock.multiplier,
      shouldAnimate: s.cesium.config.clock.shouldAnimate,
      clockRange: s.cesium.config.clock.clockRange,
    })),
  );
  const currentTime = useStoreWithCesium(
    (s) => s.cesium.config.clock.currentTime,
  );
  const setCurrentTime = useStoreWithCesium((s) => s.cesium.setCurrentTime);
  const lastSyncRef = useRef(0);
  // Tracks the last value the tick handler wrote to the store so the
  // store→Cesium effect can distinguish tick-originated writes (skip)
  // from external setCurrentTime calls (apply).
  const lastTickTimeRef = useRef<string | null>(null);

  // Cesium → Store: Throttled clock tick listener
  useEffect(() => {
    if (!viewer) return;
    const v = viewer;

    const onTick = (clock: Clock) => {
      const now = Date.now();
      if (now - lastSyncRef.current < 500) return;

      lastSyncRef.current = now;
      const iso = JulianDate.toIso8601(clock.currentTime);
      lastTickTimeRef.current = iso;
      setCurrentTime(iso);
    };

    v.clock.onTick.addEventListener(onTick);

    return () => {
      if (!v.isDestroyed()) {
        v.clock.onTick.removeEventListener(onTick);
      }
    };
  }, [viewer, setCurrentTime]);

  // Store → Cesium: Apply non-time config changes to viewer clock
  useEffect(() => {
    if (!viewer) return;
    applyClockConfigToViewer(viewer, clockInputs);
  }, [viewer, clockInputs]);

  // Store → Cesium: Apply currentTime only for external changes (not tick echoes).
  useEffect(() => {
    if (!viewer || !currentTime) return;
    if (currentTime === lastTickTimeRef.current) return;
    applyCurrentTimeToViewer(viewer, currentTime);
  }, [viewer, currentTime]);

  // Timeline zoom: only update when startTime/stopTime change (not on every currentTime tick)
  const {startTime, stopTime} = clockInputs;

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
