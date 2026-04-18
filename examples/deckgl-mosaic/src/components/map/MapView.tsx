import {DeckMap} from '@sqlrooms/deck';
import {Query, sql, useMosaicClient} from '@sqlrooms/mosaic';
import {cn} from '@sqlrooms/ui';
import type {Table as FlechetteTable} from '@uwdata/flechette';
import {tableToIPC} from '@uwdata/flechette';
import type {Table as ArrowTable} from 'apache-arrow';
import {tableFromIPC} from 'apache-arrow';
import {useEffect, useMemo, useRef, useState} from 'react';
import type {ViewState} from 'react-map-gl/maplibre';
import {useRoomStore} from '../../store';
import {MapControls} from './MapControls';
import {MapInfoModal} from './MapInfoModal';

const MAP_STYLE =
  'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

const INITIAL_VIEW_STATE = {
  longitude: -119.5,
  latitude: 37.0,
  zoom: 4.5,
  pitch: 0,
  bearing: 0,
};

export default function MapView({className}: {className?: string}) {
  const brush = useRoomStore((state) => state.mosaic.selections.brush);
  const getSelection = useRoomStore((state) => state.mosaic.getSelection);

  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [showInfo, setShowInfo] = useState(false);

  const enableBrushing = useRoomStore(
    (state) => state.mapSettings.config.enableBrushing,
  );
  const syncCharts = useRoomStore(
    (state) => state.mapSettings.config.syncCharts,
  );
  const brushRadius = useRoomStore(
    (state) => state.mapSettings.config.brushRadius,
  );
  const setEnableBrushing = useRoomStore(
    (state) => state.mapSettings.setEnableBrushing,
  );
  const setSyncCharts = useRoomStore(
    (state) => state.mapSettings.setSyncCharts,
  );
  const setBrushRadius = useRoomStore(
    (state) => state.mapSettings.setBrushRadius,
  );

  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    if (!brush) {
      getSelection('brush');
    }
  }, [brush, getSelection]);

  const {
    data: rawData,
    isLoading,
    client,
  } = useMosaicClient<FlechetteTable>({
    selectionName: 'brush',
    query: (filter: any) =>
      Query.from('earthquakes')
        .select('Latitude', 'Longitude', 'Magnitude', 'Depth', 'DateTime', {
          geom: sql`ST_AsWKB(ST_Point(Longitude, Latitude))`,
          dateLabel: sql`strftime(DateTime, '%Y-%m-%d')`,
        })
        .where(filter),
  });

  const arrowData = useMemo<ArrowTable | null>(() => {
    if (!rawData) {
      return null;
    }

    return tableFromIPC(tableToIPC(rawData, {format: 'stream'}));
  }, [rawData]);

  const datasets = useMemo(
    () =>
      arrowData
        ? {
            earthquakes: {
              arrowTable: arrowData,
              geometryColumn: 'geom',
              geometryEncodingHint: 'wkb' as const,
            },
          }
        : undefined,
    [arrowData],
  );

  useEffect(() => {
    console.log('[MapView] datasets identity changed', {
      hasDatasets: Boolean(datasets),
      rows: datasets?.earthquakes.arrowTable?.numRows,
    });
  }, [datasets]);

  const dbReady = !isLoading && arrowData !== null;

  const mapSpec = useMemo(
    () => ({
      initialViewState: INITIAL_VIEW_STATE,
      layers: [
        {
          '@@type': 'GeoArrowScatterplotLayer',
          id: 'earthquakes-fill',
          sqlroomsData: 'earthquakes',
          filled: true,
          stroked: false,
          pickable: !enableBrushing,
          getRadius: '@@=Magnitude',
          radiusScale: 3,
          radiusUnits: 'pixels',
          radiusMinPixels: 1,
          radiusMaxPixels: 20,
          getFillColor:
            '@@=[Magnitude >= 6 ? 199 : Magnitude >= 5 ? 220 : Magnitude >= 4 ? 235 : Magnitude >= 3 ? 245 : Magnitude >= 2 ? 250 : 255, Magnitude >= 6 ? 91 : Magnitude >= 5 ? 110 : Magnitude >= 4 ? 145 : Magnitude >= 3 ? 185 : Magnitude >= 2 ? 210 : 235, Magnitude >= 6 ? 74 : Magnitude >= 5 ? 88 : Magnitude >= 4 ? 105 : Magnitude >= 3 ? 135 : Magnitude >= 2 ? 160 : 200, Magnitude >= 6 ? 200 : Magnitude >= 5 ? 190 : Magnitude >= 4 ? 180 : Magnitude >= 3 ? 170 : Magnitude >= 2 ? 160 : 150]',
          lineWidthMinPixels: 1,
        },
      ],
    }),
    [enableBrushing],
  );

  const onHover = (info: {coordinate?: [number, number]}) => {
    if (!info.coordinate || !enableBrushing || !client) {
      return;
    }
    if (!syncCharts) {
      return;
    }

    const now = Date.now();
    if (now - lastUpdateRef.current < 50) {
      return;
    }

    const [lon, lat] = info.coordinate;
    const metersPerDeg = 111320;
    const cosLat = Math.cos(lat * (Math.PI / 180));
    const radiusSq = brushRadius * brushRadius;

    const predicate = sql`(
      pow((Longitude - ${lon}) * ${cosLat * metersPerDeg}, 2) +
      pow((Latitude - ${lat}) * ${metersPerDeg}, 2)
    ) < ${radiusSq}`;

    brush?.update({
      source: client,
      value: [lon, lat, brushRadius],
      predicate,
    });

    lastUpdateRef.current = now;
  };

  const clearBrush = () => {
    setEnableBrushing(false);
    if (client) {
      brush?.update({
        source: client,
        value: null,
        predicate: null as any,
      });
    }
  };

  const toggleSyncCharts = () => {
    const next = !syncCharts;
    setSyncCharts(next);
    if (!next && client) {
      brush?.update({
        source: client,
        value: null,
        predicate: null as any,
      });
    }
  };

  return (
    <div className={cn('flex h-full w-full', className)}>
      <div className="relative flex-1">
        {arrowData ? (
          <DeckMap
            className="h-full w-full"
            spec={mapSpec}
            datasets={datasets}
            mapStyle={MAP_STYLE}
            mapProps={{projection: 'mercator'}}
            deckProps={{
              controller: true,
              viewState,
              onViewStateChange: ({viewState: next}: any) =>
                setViewState(next as ViewState),
              onHover: onHover as any,
              getTooltip: ({object}: {object?: any}) =>
                !enableBrushing &&
                object && {
                  html: `<div style="font-family:system-ui; font-size:12px; padding:4px;">
                      <strong>M ${Number(object.Magnitude).toFixed(1)}</strong><br/>
                      Depth: ${object.Depth}km<br/>
                      ${String(object.dateLabel ?? '')}
                    </div>`,
                },
            }}
          />
        ) : (
          <div className="h-full w-full bg-slate-100" />
        )}

        <MapControls
          dbReady={dbReady}
          enableBrushing={enableBrushing}
          setEnableBrushing={setEnableBrushing}
          syncCharts={syncCharts}
          toggleSyncCharts={toggleSyncCharts}
          brushRadius={brushRadius}
          setBrushRadius={setBrushRadius}
          clearBrush={clearBrush}
          onShowInfo={() => setShowInfo(true)}
        />

        {showInfo ? <MapInfoModal onClose={() => setShowInfo(false)} /> : null}
      </div>
    </div>
  );
}
