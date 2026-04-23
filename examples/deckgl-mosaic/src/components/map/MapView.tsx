import type {ColorScaleConfig} from '@sqlrooms/color-scales';
import {DeckJsonMap} from '@sqlrooms/deck';
import {
  asc,
  column,
  MosaicColorLegend,
  Query,
  sql,
  useMosaicClient,
} from '@sqlrooms/mosaic';
import {cn, ResolvedTheme, useTheme} from '@sqlrooms/ui';
import {useEffect, useMemo, useRef, useState} from 'react';
import type {ViewState} from 'react-map-gl/maplibre';
import {useRoomStore} from '../../store';
import {MapControls} from './MapControls';
import {MapInfoModal} from './MapInfoModal';

const MAP_STYLES: Record<ResolvedTheme, string> = {
  light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
};

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
  } = useMosaicClient({
    selectionName: 'brush',
    query: (filter: any) =>
      Query.from('earthquakes')
        .select('Latitude', 'Longitude', 'Magnitude', 'Depth', 'DateTime', {
          geom: sql`ST_AsWKB(ST_Point(Longitude, Latitude))`,
          dateLabel: sql`strftime(DateTime, '%Y-%m-%d')`,
        })
        .where(filter)
        .orderby([asc(column('Magnitude'))]),
  });

  const datasets = useMemo(
    () => ({
      earthquakes: {
        arrowTable: rawData ?? undefined,
        geometryColumn: 'geom',
        geometryEncodingHint: 'wkb' as const,
      },
    }),
    [rawData],
  );
  const dbReady = !isLoading && rawData !== null;
  const {resolvedTheme} = useTheme();
  const colorScale = useMemo(() => {
    return {
      field: 'Magnitude',
      type: 'sequential',
      scheme: 'YlOrBr',
      domain: [0, 8],
      reverse: resolvedTheme === 'dark',
      clamp: true,
    } satisfies ColorScaleConfig;
  }, [resolvedTheme]);

  const legendColorScale = useMemo(
    () =>
      ({
        ...colorScale,
        legend: {title: 'Magnitude'},
      }) satisfies ColorScaleConfig,
    [colorScale],
  );

  const mapSpec = useMemo(
    () => ({
      initialViewState: INITIAL_VIEW_STATE,
      layers: [
        {
          '@@type': 'GeoArrowScatterplotLayer',
          id: 'earthquakes',
          _sqlroomsBinding: {
            dataset: 'earthquakes',
          },
          getFillColor: {
            '@@function': 'colorScale',
            ...colorScale,
          },
          filled: true,
          stroked: false,
          pickable: !enableBrushing,
          getRadius: '@@=Magnitude',
          radiusScale: 1,
          radiusUnits: 'pixels',
          radiusMinPixels: 1,
          radiusMaxPixels: 10,
          lineWidthMinPixels: 1,
        },
      ],
    }),
    [colorScale, enableBrushing],
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
        <DeckJsonMap
          className="h-full w-full"
          spec={mapSpec}
          datasets={datasets}
          showLegends={false}
          mapStyle={MAP_STYLES[resolvedTheme]}
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

        <MosaicColorLegend
          className="absolute bottom-2 left-2 z-10"
          colorScale={legendColorScale}
          selection={brush ?? undefined}
          tickFormat=".1f"
          width={220}
        />

        {showInfo ? <MapInfoModal onClose={() => setShowInfo(false)} /> : null}
      </div>
    </div>
  );
}
