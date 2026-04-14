import {CesiumPanel} from '@sqlrooms/cesium';
import {Spinner, cn} from '@sqlrooms/ui';
import {Cartographic} from 'cesium';
import {useEffect, useMemo, useRef} from 'react';
import {
  OPENSKY_FLIGHT_LAYER_ID,
  OPENSKY_NYC_TABLE_NAME,
  useRoomStore,
} from '../store';

function FlightsMapOverlay() {
  const viewer = useRoomStore((state) => state.cesium.viewer);
  const isLoadingData = useRoomStore((state) => state.cesium.isLoadingData);
  const visibleFlightCount = useRoomStore(
    (state) => state.cesium.layerEntityCounts[OPENSKY_FLIGHT_LAYER_ID] ?? 0,
  );
  const flightPointsTable = useRoomStore((state) =>
    state.db.findTableByName(OPENSKY_NYC_TABLE_NAME),
  );
  const cameraConfig = useRoomStore((state) => state.cesium.config.camera);
  const navigationRef = useRef<{destroy?: () => void} | null>(null);
  const navigationOptionsRef = useRef({
    defaultResetView: Cartographic.fromDegrees(
      cameraConfig.longitude,
      cameraConfig.latitude,
      cameraConfig.height,
    ),
    orientation: {
      heading: cameraConfig.heading,
      pitch: cameraConfig.pitch,
      roll: cameraConfig.roll,
    },
    enableCompass: true,
    enableZoomControls: false,
    enableDistanceLegend: false,
    enableCompassOuterRing: true,
    resetTooltip: 'Reset view',
    zoomInTooltip: 'Zoom in',
    zoomOutTooltip: 'Zoom out',
  });

  const isLoading = useMemo(
    () => !flightPointsTable || isLoadingData,
    [flightPointsTable, isLoadingData],
  );

  useEffect(() => {
    if (!viewer) {
      navigationRef.current?.destroy?.();
      navigationRef.current = null;
      return;
    }

    let cancelled = false;

    void (async () => {
      const module = await import('cesium-navigation-es6');
      const CesiumNavigation = (
        module as {default?: new (...args: any[]) => any}
      ).default;

      if (!CesiumNavigation || cancelled || navigationRef.current) {
        return;
      }

      navigationRef.current = new CesiumNavigation(
        viewer,
        navigationOptionsRef.current,
      );
    })();

    return () => {
      cancelled = true;
      navigationRef.current?.destroy?.();
      navigationRef.current = null;
    };
  }, [viewer]);

  return (
    <>
      <div className="pointer-events-none absolute top-3 left-3 z-10">
        <div className="bg-background/88 border-border/80 min-w-44 rounded-md border px-3 py-2 shadow-sm backdrop-blur">
          <div className="text-muted-foreground text-[11px] tracking-[0.14em] uppercase">
            Airborne Now
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {isLoading ? '...' : visibleFlightCount.toLocaleString()}
          </div>
          <div className="text-muted-foreground mt-1 text-xs leading-4">
            Visible flights at the current timeline moment after all filters.
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-background/28 absolute inset-0 z-20 flex items-center justify-center backdrop-blur-[2px]">
          <div className="bg-background/90 border-border/80 flex items-center gap-3 rounded-lg border px-4 py-3 shadow-sm">
            <Spinner className="text-muted-foreground h-4 w-4" />
            <div>
              <div className="text-sm font-medium">Loading flight models</div>
              <div className="text-muted-foreground text-xs">
                Preparing the filtered Cesium layer…
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function FlightsGlobePanel() {
  return (
    <div className={cn('relative h-full w-full overflow-hidden')}>
      <CesiumPanel />
      <FlightsMapOverlay />
    </div>
  );
}
