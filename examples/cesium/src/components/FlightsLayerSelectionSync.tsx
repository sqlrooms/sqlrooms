import {useEffect, useMemo, useState} from 'react';
import {
  FLIGHT_FILTER_SELECTION_NAME,
  buildOpenSkyFlightPointsQuery,
  useRoomStore,
} from '../store';

export function FlightsLayerSelectionSync() {
  const mosaic = useRoomStore((state) => state.mosaic);
  const updateLayer = useRoomStore((state) => state.cesium.updateLayer);
  const currentQuery = useRoomStore(
    (state) =>
      state.cesium.config.layers.find((layer) => layer.id === 'opensky-flights')
        ?.sqlQuery,
  );
  const [selectionVersion, setSelectionVersion] = useState(0);
  const selection = useMemo(
    () => mosaic.getSelection(FLIGHT_FILTER_SELECTION_NAME),
    [mosaic],
  );

  useEffect(() => {
    const handleSelectionChange = () => {
      setSelectionVersion((version) => version + 1);
    };

    selection.addEventListener('value', handleSelectionChange);
    return () => {
      selection.removeEventListener('value', handleSelectionChange);
    };
  }, [selection]);

  const nextQuery = useMemo(() => {
    void selectionVersion;
    return buildOpenSkyFlightPointsQuery(selection.predicate());
  }, [selection, selectionVersion]);

  useEffect(() => {
    if (nextQuery !== currentQuery) {
      updateLayer('opensky-flights', {sqlQuery: nextQuery});
    }
  }, [currentQuery, nextQuery, updateLayer]);

  return null;
}
