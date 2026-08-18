import {useMemo} from 'react';
import {useRoomStore, type HoverBrush} from '../store';

/** Returns the shared room-store brush actions in the component-facing shape. */
export function useHoverBrush(): HoverBrush {
  const enabled = useRoomStore((state) => state.forecast.brushEnabled);
  const radiusKm = useRoomStore((state) => state.forecast.brushRadiusKm);
  const center = useRoomStore((state) => state.forecast.brushCenter);
  const toggle = useRoomStore((state) => state.forecast.toggleBrush);
  const setRadiusKm = useRoomStore((state) => state.forecast.setBrushRadiusKm);
  const onPointerMove = useRoomStore(
    (state) => state.forecast.onBrushPointerMove,
  );
  const clear = useRoomStore((state) => state.forecast.clearBrush);

  return useMemo(
    () => ({
      enabled,
      radiusKm,
      active: center !== null,
      toggle,
      setRadiusKm,
      onPointerMove,
      clear,
    }),
    [enabled, radiusKm, center, toggle, setRadiusKm, onPointerMove, clear],
  );
}
