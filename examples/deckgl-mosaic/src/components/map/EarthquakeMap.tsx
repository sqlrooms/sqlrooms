'use client';

import {useEffect, useState, useRef, useMemo} from 'react';
import {initMosaic, brush} from '@/lib/mosaic';
import {makeClient} from '@uwdata/mosaic-core';
import {Query, sql} from '@uwdata/mosaic-sql';
import * as vg from '@uwdata/vgplot';
import DeckGL from '@deck.gl/react';
import {GeoArrowScatterplotLayer} from '@geoarrow/deck.gl-layers';
import Map from 'react-map-gl/mapbox';
import {Loader2} from 'lucide-react';
import {Table} from 'apache-arrow';

import EarthquakeCharts from '@/components/charts/EarthquakeCharts';
import {MapControls} from './MapControls';
import {MapInfoModal} from './MapInfoModal';

import 'mapbox-gl/dist/mapbox-gl.css';
import {buildGeoArrowPointTable} from '@/app/utils';

const INITIAL_VIEW_STATE = {
  longitude: -119.5,
  latitude: 37.0,
  zoom: 4.5,
  pitch: 0,
  bearing: 0,
};

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '';

function getZoomFactor({
  zoom,
  zoomOffset = 0,
}: {
  zoom: number;
  zoomOffset?: number;
}) {
  return Math.pow(2, Math.max(14 - zoom + zoomOffset, 0));
}

export default function EarthquakeMap() {
  const deckRef = useRef<any>(null);
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [data, setData] = useState<Table | null>(null);
  const [dbReady, setDbReady] = useState(false);

  const [enableBrushing, setEnableBrushing] = useState(false);
  const [syncCharts, setSyncCharts] = useState(true);
  const [brushRadius, setBrushRadius] = useState(50000);
  const [showInfo, setShowInfo] = useState(false);

  const lastUpdateRef = useRef<number>(0);
  const clientRef = useRef<any>(null);

  useEffect(() => {
    let activeClient: any = null;

    async function init() {
      await initMosaic();

      const mainCoordinator = vg.coordinator();
      try {
        await mainCoordinator.exec('INSTALL spatial; LOAD spatial;');
      } catch {}

      activeClient = makeClient({
        coordinator: mainCoordinator,
        selection: brush,
        query: (filter) => {
          return Query.from('earthquakes')
            .select('Latitude', 'Longitude', 'Magnitude', 'Depth', 'DateTime')
            .where(filter);
        },
        queryResult: (result) => {
          const table = buildGeoArrowPointTable(
            result.getChild('Latitude'),
            result.getChild('Longitude'),
            result.getChild('Magnitude'),
            result.getChild('Depth'),
            result.getChild('DateTime'),
          );

          setData(table);
        },
      });

      clientRef.current = activeClient;
      setDbReady(true);
    }

    init();

    return () => {
      if (activeClient) {
        vg.coordinator().disconnect(activeClient);
      }
    };
  }, []);

  const onHover = (info: any) => {
    if (!info.coordinate || !enableBrushing || !clientRef.current) return;
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
      source: clientRef.current,
      value: [lon, lat, brushRadius],
      predicate,
    });

    lastUpdateRef.current = now;
  };

  const clearBrush = () => {
    setEnableBrushing(false);
    if (clientRef.current) {
      brush.update({
        source: clientRef.current,
        value: null,
        predicate: null as any,
      });
    }
  };

  const toggleSyncCharts = () => {
    const next = !syncCharts;
    setSyncCharts(next);
    if (!next && clientRef.current) {
      brush.update({
        source: clientRef.current,
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
      getPosition: data.getChild('geom'),
      getFillColor: ({index, data}) => {
        const batch = data.data;
        const mag = batch.getChild('Magnitude').get(index);
        if (mag >= 6.0) return [199, 91, 74, 200];
        if (mag >= 5.0) return [220, 110, 88, 190];
        if (mag >= 4.0) return [235, 145, 105, 180];
        if (mag >= 3.0) return [245, 185, 135, 170];
        if (mag >= 2.0) return [250, 210, 160, 160];
        return [255, 235, 200, 150];
      },
      getRadius: ({index, data}) => {
        const batch = data.data;
        const mag = batch.getChild('Magnitude').get(index);
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
    <div className="flex h-screen w-screen overflow-hidden bg-[#1b1a18]">
      <div className="relative flex-1">
        <DeckGL
          useDevicePixels={false}
          ref={deckRef}
          viewState={viewState}
          onViewStateChange={({viewState: next}) => setViewState(next)}
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
          <Map
            mapboxAccessToken={MAPBOX_TOKEN}
            mapStyle="mapbox://styles/mapbox/dark-v11"
            projection="mercator"
          />
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

      <div className="flex h-full w-[420px] flex-col border-[#2a2825] bg-[#f3efe7] text-slate-100">
        {dbReady && <EarthquakeCharts />}
        {!dbReady && (
          <div className="flex flex-1 items-center justify-center p-4">
            <Loader2 className="mr-2 h-8 w-8 animate-spin text-slate-800" />
          </div>
        )}
      </div>
    </div>
  );
}
