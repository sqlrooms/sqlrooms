import {useMemo, type FC} from 'react';
import {useRoomStore, type HoverBrush} from '../store';
import {MapPane, MapShell} from './MapPane';

export const MainView: FC = () => {
  const {
    lab,
    setMap,
    brushEnabled,
    brushRadiusKm,
    brushCenter,
    toggleBrush,
    setBrushRadiusKm,
    onBrushPointerMove,
  } = useRoomStore((state) => state.forecast);

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
    <div className="relative h-full w-full">
      <MapPane cube={lab.cube.temperature} brush={brush} onMap={setMap} />
    </div>
  );
};

export {MapShell};
