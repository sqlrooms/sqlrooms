import DeckGL from '@deck.gl/react';
import {GeoArrowScatterplotLayer} from '@geoarrow/deck.gl-layers';
import {Query, sql, useMosaicClient} from '@sqlrooms/mosaic';
import {Table} from 'apache-arrow';
import {Loader2} from 'lucide-react';
import {useMemo, useRef, useState} from 'react';
import Map, {ViewState} from 'react-map-gl/maplibre';
import {roomStore} from '../../store';
import {MapControls} from './MapControls';
import {MapInfoModal} from './MapInfoModal';
import {buildGeoArrowPointTable} from './utils';

const MAP_STYLE =
  'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

const INITIAL_VIEW_STATE = {
  longitude: -119.5,
  latitude: 37.0,
  zoom: 4.5,
  pitch: 0,
  bearing: 0,
};

function getZoomFactor({
  zoom,
  zoomOffset = 0,
}: {
  zoom: number;
  zoomOffset?: number;
}) {
  return Math.pow(2, Math.max(14 - zoom + zoomOffset, 0));
}

export default function MapView() {
  const deckRef = useRef<any>(null);
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);

  const [enableBrushing, setEnableBrushing] = useState(false);
  const [syncCharts, setSyncCharts] = useState(true);
  const [brushRadius, setBrushRadius] = useState(50000);
  const [showInfo, setShowInfo] = useState(false);

  const lastUpdateRef = useRef<number>(0);

  // Get the brush selection from the store
  const brush = useMemo(() => {
    const state = roomStore.getState();
    // Type assertion needed until package is rebuilt
    return (state.mosaic as any).getSelection('brush');
  }, []);

  // Use the mosaic client hook
  const {
    data: rawData,
    isLoading,
    client,
  } = useMosaicClient<Table>({
    selectionName: 'brush',
    query: (filter: any) => {
      return Query.from('earthquakes')
        .select('Latitude', 'Longitude', 'Magnitude', 'Depth', 'DateTime')
        .where(filter);
    },
  });

  // Transform raw Arrow table to GeoArrow format
  const data = useMemo(() => {
    if (!rawData) return null;
    return buildGeoArrowPointTable(
      rawData.getChild('Latitude'),
      rawData.getChild('Longitude'),
      rawData.getChild('Magnitude'),
      rawData.getChild('Depth'),
      rawData.getChild('DateTime'),
    );
  }, [rawData]);

  const dbReady = !isLoading && data !== null;

  const onHover = (info: any) => {
    if (!info.coordinate || !enableBrushing || !client) return;
    if (!syncCharts) return;

    const now = Date.now();
    if (now - lastUpdateRef.current < 50) return;

    const [lon, lat] = info.coordinate;
    const metersPerDeg = 111320;
    const cosLat = Math.cos(lat * (Math.PI / 180));
    const radiusSq = brushRadius * brushRadius;

    const predicate = sql`(
      pow((Longitude - ${lon}) * ${cosLat * metersPerDeg}, 2) +
      pow((Latitude - ${lat}) * ${metersPerDeg}, 2)
    ) < ${radiusSq}`;

    brush.update({
      source: client,
      value: [lon, lat, brushRadius],
      predicate,
    });

    lastUpdateRef.current = now;
  };

  const clearBrush = () => {
    setEnableBrushing(false);
    if (client) {
      brush.update({
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
      brush.update({
        source: client,
        value: null,
        predicate: null as any,
      });
    }
  };

  const scatterLayer = useMemo(() => {
    if (!data) return null;
    return new GeoArrowScatterplotLayer({
      id: 'earthquakes',
      data,
      getPosition: data.getChild('geom')!,
      getFillColor: ({index, data}) => {
        const batch = data.data;
        const mag = batch.getChild('Magnitude')?.get(index) ?? 0;
        if (mag >= 6.0) return [199, 91, 74, 200];
        if (mag >= 5.0) return [220, 110, 88, 190];
        if (mag >= 4.0) return [235, 145, 105, 180];
        if (mag >= 3.0) return [245, 185, 135, 170];
        if (mag >= 2.0) return [250, 210, 160, 160];
        return [255, 235, 200, 150];
      },
      getRadius: ({index, data}) => {
        const batch = data.data;
        const mag = batch.getChild('Magnitude')?.get(index) ?? 0;
        return mag * mag;
      },
      radiusScale: getZoomFactor({zoom: viewState.zoom}),
      radiusMinPixels: 1,
      radiusMaxPixels: 20,
      pickable: !enableBrushing,
      stroked: true,
      getLineColor: [140, 140, 140, 90],
      lineWidthMinPixels: 1,
    });
  }, [data, enableBrushing, viewState.zoom]);

  return (
    <div className="flex h-full w-full">
      <div className="relative flex-1">
        <DeckGL
          useDevicePixels={false}
          ref={deckRef}
          viewState={viewState}
          onViewStateChange={({viewState: next}) =>
            setViewState(next as ViewState)
          }
          controller={true}
          layers={[scatterLayer]}
          onHover={onHover}
          getTooltip={({object}) =>
            !enableBrushing &&
            object && {
              html: `<div style="font-family:system-ui; font-size:12px; padding:4px;">
                  <strong>M ${Number(object.Magnitude).toFixed(1)}</strong><br/>
                  Depth: ${object.Depth}km<br/>
                  ${new Date(Number(object.DateTime)).toLocaleDateString()}
                </div>`,
            }
          }
        >
          <Map mapStyle={MAP_STYLE} projection="mercator" />
        </DeckGL>

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

        {showInfo && <MapInfoModal onClose={() => setShowInfo(false)} />}

        {!dbReady && (
          <div className="absolute left-0 top-0 z-40 flex h-full w-full items-center justify-center bg-black/40 text-white backdrop-blur-sm">
            <Loader2 className="mr-2 h-8 w-8 animate-spin" />
            <span>Loading earthquakes...</span>
          </div>
        )}
      </div>
    </div>
  );
}
