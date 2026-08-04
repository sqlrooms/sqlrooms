import {useCallback, useRef, useState} from 'react';
import type {Selection} from '@uwdata/mosaic-core';
import {geoCirclePredicateExpr} from '../lab/geo-filter';
import type {MapBrushCenter, MapView} from '../lab/map-view';
import {BOUNDS} from '../lab/types';

export type HoverBrush = {
  enabled: boolean;
  radiusKm: number;
  active: boolean;
  toggle: () => void;
  setRadiusKm: (radiusKm: number) => void;
  onPointerMove: (clientX: number, clientY: number) => void;
};

/**
 * Map hover brush. Publishes a geo-circle clause into the shared Mosaic
 * selection while the pointer moves over the map. The stable source object
 * also serves as the Mosaic clause source, so Selection.reset() clears it.
 */
export function useHoverBrush(
  selection: Selection,
  map: MapView | null,
): HoverBrush {
  const [enabled, setEnabled] = useState(false);
  const [radiusKm, setRadius] = useState(175);
  const [center, setCenter] = useState<MapBrushCenter | null>(null);

  const mapRef = useRef(map);
  mapRef.current = map;
  const radiusRef = useRef(radiusKm);
  const centerRef = useRef<MapBrushCenter | null>(null);

  const sourceRef = useRef<{reset: () => void} | null>(null);
  if (!sourceRef.current) {
    sourceRef.current = {
      reset: () => {
        centerRef.current = null;
        setCenter(null);
        mapRef.current?.setBrushCenter(null);
      },
    };
  }

  const publish = useCallback(
    (nextCenter: MapBrushCenter | null) => {
      centerRef.current = nextCenter;
      setCenter(nextCenter);
      mapRef.current?.setBrushCenter(nextCenter);
      selection.update({
        source: sourceRef.current!,
        value: nextCenter,
        predicate: nextCenter
          ? geoCirclePredicateExpr({
              center: nextCenter,
              radiusKm: radiusRef.current,
            })
          : null,
      });
    },
    [selection],
  );

  const toggle = useCallback(() => {
    setEnabled((current) => {
      const next = !current;
      mapRef.current?.setBrushEnabled(next);
      mapRef.current?.setBrushRadiusKm(radiusRef.current);
      centerRef.current = null;
      setCenter(null);
      if (!next) publish(null);
      return next;
    });
  }, [publish]);

  const setRadiusKm = useCallback(
    (nextRadius: number) => {
      radiusRef.current = nextRadius;
      setRadius(nextRadius);
      mapRef.current?.setBrushRadiusKm(nextRadius);
      if (centerRef.current) publish(centerRef.current);
    },
    [publish],
  );

  const onPointerMove = useCallback(
    (clientX: number, clientY: number) => {
      const next = mapRef.current?.screenToLngLat(clientX, clientY);
      if (
        !next ||
        next.lon < BOUNDS.west ||
        next.lon > BOUNDS.east ||
        next.lat < BOUNDS.south ||
        next.lat > BOUNDS.north
      ) {
        return;
      }
      publish(next);
    },
    [publish],
  );

  return {
    enabled,
    radiusKm,
    active: center !== null,
    toggle,
    setRadiusKm,
    onPointerMove,
  };
}
