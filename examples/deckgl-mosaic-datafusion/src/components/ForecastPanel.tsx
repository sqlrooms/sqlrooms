import {useMemo, type FC} from 'react';
import {useRoomStore, type ForecastSession, type HoverBrush} from '../store';
import {ForecastControls} from './Sidebar';
import {MosaicCharts} from './MosaicCharts';

/**
 * Left-tab panel content: the forecast lead slider/stats/hover-brush
 * controls above the four crossfiltered vgplot charts. In the original
 * standalone app these sat in one absolutely-positioned docked sidebar;
 * here RoomShell's tab panel already provides the scroll container and
 * chrome, so only the content is ported.
 */
export const ForecastPanel: FC = () => {
  const {
    lab,
    streaming,
    leadIndex,
    forecastTimeMs,
    selectedCount,
    meanTemp,
    selectedAreaKm2,
    hotAreaKm2,
    playing,
    requestLead,
    togglePlay,
    reset,
    brushEnabled,
    brushRadiusKm,
    brushCenter,
    toggleBrush,
    setBrushRadiusKm,
    onBrushPointerMove,
  } = useRoomStore((state) => state.forecast);

  const session: ForecastSession = useMemo(
    () => ({
      leadIndex,
      forecastTimeMs,
      selectedCount,
      meanTemp,
      selectedAreaKm2,
      hotAreaKm2,
      playing,
      requestLead,
      togglePlay,
      reset,
    }),
    [
      leadIndex,
      forecastTimeMs,
      selectedCount,
      meanTemp,
      selectedAreaKm2,
      hotAreaKm2,
      playing,
      requestLead,
      togglePlay,
      reset,
    ],
  );

  const brush: HoverBrush = useMemo(
    () => ({
      enabled: brushEnabled,
      radiusKm: brushRadiusKm,
      active: brushCenter !== null,
      toggle: toggleBrush,
      setRadiusKm: setBrushRadiusKm,
      onPointerMove: onBrushPointerMove,
    }),
    [
      brushEnabled,
      brushRadiusKm,
      brushCenter,
      toggleBrush,
      setBrushRadiusKm,
      onBrushPointerMove,
    ],
  );

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-4">
      {streaming && (
        <p className="text-muted-foreground text-xs">Streaming ECMWF chunks…</p>
      )}
      <ForecastControls
        session={session}
        brush={brush}
        leadCount={lab.cube.leadCount}
      />
      <div className="flex flex-1 flex-col gap-4">
        <MosaicCharts
          coordinator={lab.coordinator}
          selection={lab.selection}
          streaming={streaming}
        />
      </div>
    </div>
  );
};
