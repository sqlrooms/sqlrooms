/**
 * Resium Viewer wrapper with lifecycle management and store synchronization.
 * Core component that manages the Cesium viewer instance.
 */

import React, {useRef, useEffect} from 'react';
import {Viewer, CesiumComponentRef} from 'resium';
import {
  Viewer as CesiumViewer,
  Cartesian3,
  SceneMode,
  Color,
  Ion,
  JulianDate,
  Terrain,
  EllipsoidTerrainProvider,
  OpenStreetMapImageryProvider,
} from 'cesium';
// Note: Clock is managed entirely by useClockSync hook (imperative API).
// Using Resium's <Clock> component caused conflicts with imperative updates.
import {useStoreWithCesium} from '../cesium-slice';
import {CesiumEntityLayer} from './CesiumEntityLayer';
import {useClockSync} from '../hooks/useClockSync';

/**
 * Imperatively configure terrain and imagery on a Cesium viewer.
 * Extracted as a module-level function to avoid React Compiler immutability tracking.
 *
 * Strategy:
 * - With Ion token + terrain enabled: use Terrain.fromWorldTerrain() for real 3D terrain
 * - Without Ion token or terrain disabled: use flat EllipsoidTerrainProvider
 * - For imagery: OpenStreetMap when no Ion token or explicitly configured
 */
function setupTerrainAndImagery(
  viewer: CesiumViewer,
  terrainEnabled: boolean,
  baseLayerImagery: string,
): void {
  const hasIonToken = Boolean(Ion.defaultAccessToken);

  // Set up terrain
  if (terrainEnabled && hasIonToken) {
    // Use Cesium Ion world terrain (requires valid token)
    viewer.scene.setTerrain(Terrain.fromWorldTerrain());
  } else {
    // Flat ellipsoid terrain (no external dependency)
    viewer.terrainProvider = new EllipsoidTerrainProvider();
  }

  // Set up imagery based on config and token availability
  if (baseLayerImagery === 'openstreetmap' || !hasIonToken) {
    // Remove default Ion imagery and add OpenStreetMap
    viewer.imageryLayers.removeAll();
    viewer.imageryLayers.addImageryProvider(
      new OpenStreetMapImageryProvider({
        url: 'https://tile.openstreetmap.org/',
      }),
    );
  }
  // 'ion-default' with a valid token uses Cesium's built-in default imagery (Bing Maps via Ion)
  // 'none' would leave whatever default is configured
}

const NYC_TIME_ZONE = 'America/New_York';

const nycTimelineFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: NYC_TIME_ZONE,
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

const nycAnimationDateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: NYC_TIME_ZONE,
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const nycAnimationTimeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: NYC_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
  timeZoneName: 'short',
});

function applyNycTimeFormatters(viewer: CesiumViewer): void {
  const timeline = viewer.timeline as
    | {
        makeLabel?: (time: JulianDate) => string;
        updateFromClock?: () => void;
      }
    | undefined;

  if (timeline) {
    timeline.makeLabel = (time: JulianDate) =>
      nycTimelineFormatter.format(JulianDate.toDate(time));
    timeline.updateFromClock?.();
  }

  const animation = (viewer as any).animation as
    | {
        viewModel?: {
          dateFormatter?: (time: JulianDate) => string;
          timeFormatter?: (time: JulianDate) => string;
        };
      }
    | undefined;

  if (animation?.viewModel) {
    animation.viewModel.dateFormatter = (time: JulianDate) =>
      nycAnimationDateFormatter.format(JulianDate.toDate(time));
    animation.viewModel.timeFormatter = (time: JulianDate) =>
      nycAnimationTimeFormatter.format(JulianDate.toDate(time));
  }
}

const SCENE_MODE_MAP = {
  SCENE3D: SceneMode.SCENE3D,
  SCENE2D: SceneMode.SCENE2D,
  COLUMBUS_VIEW: SceneMode.COLUMBUS_VIEW,
} as const;

/**
 * Wraps Resium Viewer component with SQLRooms lifecycle management.
 *
 * **Lifecycle Pattern** (from cosmos):
 * 1. Create ref for Viewer component
 * 2. On mount: register viewer in store, apply initial camera, attach listeners
 * 3. On config changes: apply imperatively (don't re-create viewer)
 * 4. On unmount: cleanup listeners, null viewer ref
 *
 * **Critical**: Mount viewer ONCE. Never re-create on config changes.
 * Updates applied via imperative API (viewer.camera.setView) not React re-renders.
 *
 * **Granular Selectors**: Only select specific state to prevent unnecessary re-renders.
 *
 * @example
 * ```typescript
 * <CesiumViewerWrapper />
 * ```
 */
export const CesiumViewerWrapper: React.FC = () => {
  const viewerInstanceRef = useRef<CesiumViewer | null>(null);

  // Granular selectors (prevent re-renders on unrelated state changes)
  const setViewer = useStoreWithCesium((s) => s.cesium.setViewer);
  const saveCameraPosition = useStoreWithCesium(
    (s) => s.cesium.saveCameraPosition,
  );
  const cameraConfig = useStoreWithCesium((s) => s.cesium.config.camera);
  const sceneMode = useStoreWithCesium((s) => s.cesium.config.sceneMode);
  const showTimeline = useStoreWithCesium((s) => s.cesium.config.showTimeline);
  const showAnimation = useStoreWithCesium(
    (s) => s.cesium.config.showAnimation,
  );
  const layers = useStoreWithCesium((s) => s.cesium.config.layers);
  const terrainEnabled = useStoreWithCesium((s) => s.cesium.config.terrain);
  const baseLayerImagery = useStoreWithCesium(
    (s) => s.cesium.config.baseLayerImagery,
  );
  const depthTestAgainstTerrain = useStoreWithCesium(
    (s) => s.cesium.config.depthTestAgainstTerrain,
  );

  // Callback ref to capture viewer when Resium creates it
  const handleViewerRef = (
    resiumRef: CesiumComponentRef<CesiumViewer> | null,
  ) => {
    if (!resiumRef) return;

    const viewer = resiumRef.cesiumElement;
    if (!viewer) return;

    // Avoid re-initializing if already set
    if (viewerInstanceRef.current === viewer) return;

    viewerInstanceRef.current = viewer;

    // Set dark background for space behind the globe
    // Set up terrain based on config and Ion token availability
    setupTerrainAndImagery(viewer, terrainEnabled, baseLayerImagery);
    applyNycTimeFormatters(viewer);

    viewer.scene.backgroundColor = Color.fromCssColorString('#0a0a14');
    viewer.scene.globe.depthTestAgainstTerrain = depthTestAgainstTerrain;

    // Register viewer in store
    setViewer(viewer);

    // Apply initial camera position from config
    viewer.camera.setView({
      destination: Cartesian3.fromDegrees(
        cameraConfig.longitude,
        cameraConfig.latitude,
        cameraConfig.height,
      ),
      orientation: {
        heading: cameraConfig.heading,
        pitch: cameraConfig.pitch,
        roll: cameraConfig.roll,
      },
    });

    // Save camera position when user finishes moving
    // Only fires on moveEnd (not during drag) to reduce write frequency
    viewer.camera.moveEnd.addEventListener(saveCameraPosition);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const viewer = viewerInstanceRef.current;
      if (viewer && !viewer.isDestroyed()) {
        viewer.camera.moveEnd.removeEventListener(saveCameraPosition);
      }
      setViewer(null);
      viewerInstanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps = unmount only

  // Activate bidirectional clock sync (sole clock manager — no <Clock> component)
  useClockSync();

  return (
    <Viewer
      ref={handleViewerRef}
      full
      timeline={showTimeline}
      animation={showAnimation}
      sceneMode={SCENE_MODE_MAP[sceneMode]}
      // Disable default UI elements (can enable via config later)
      baseLayerPicker={false}
      geocoder={false}
      homeButton={false}
      navigationHelpButton={false}
      sceneModePicker={false}
    >
      {/* Render configured layers */}
      {layers.map((layer) => {
        if (!layer.visible) return null;

        switch (layer.type) {
          case 'sql-entities':
            return <CesiumEntityLayer key={layer.id} layerConfig={layer} />;

          // Future layer types: geojson, czml, tileset
          default:
            return null;
        }
      })}
    </Viewer>
  );
};
