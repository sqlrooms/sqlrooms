import {DeckJsonMap} from '@sqlrooms/deck';
import type {DeckDatasetInput} from '@sqlrooms/deck';
import {useMemo, useState} from 'react';
import {NavigationControl, Popup} from 'react-map-gl/maplibre';

const INITIAL_VIEW_STATE = {
  latitude: 18,
  longitude: 5,
  zoom: 1.35,
  bearing: 0,
  pitch: 0,
};

const MAP_STYLE =
  'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

type AirportRow = {
  name: string;
  abbrev: string;
  scalerank: number;
  longitude: number;
  latitude: number;
};

type MapPickingInfo = {
  object?: unknown;
};

const AIRPORT_MAP_SPEC = {
  initialViewState: INITIAL_VIEW_STATE,
  controller: true,
  layers: [
    {
      '@@type': 'GeoArrowScatterplotLayer',
      id: 'airports',
      _sqlroomsBinding: {
        dataset: 'airports',
      },
      opacity: 0.7,
      filled: true,
      stroked: true,
      pickable: true,
      radiusUnits: 'pixels',
      radiusMinPixels: 2,
      radiusMaxPixels: 6,
      getRadius: 2,
      getFillColor: [73, 111, 138, 140],
      getLineColor: [30, 41, 59, 80],
      lineWidthMinPixels: 1,
    },
    {
      '@@type': 'GeoArrowScatterplotLayer',
      id: 'major-airports',
      _sqlroomsBinding: {
        dataset: 'majorAirports',
      },
      opacity: 0.95,
      filled: true,
      stroked: true,
      pickable: true,
      radiusUnits: 'pixels',
      radiusMinPixels: 4,
      radiusMaxPixels: 10,
      getRadius: 6,
      getFillColor: [210, 89, 62, 220],
      getLineColor: [110, 29, 24, 180],
      lineWidthMinPixels: 1,
    },
  ],
} as const;

export const MapView = () => {
  const [selected, setSelected] = useState<AirportRow | null>(null);

  const datasets = useMemo<Record<string, DeckDatasetInput>>(
    () => ({
      airports: {
        sqlQuery: `
          SELECT
            name,
            abbrev,
            scalerank,
            ST_X(geom) AS longitude,
            ST_Y(geom) AS latitude,
            ST_AsWKB(geom) AS geom
          FROM airports
        `,
        geometryEncodingHint: 'wkb',
      },
      majorAirports: {
        sqlQuery: `
          SELECT
            name,
            abbrev,
            scalerank,
            ST_X(geom) AS longitude,
            ST_Y(geom) AS latitude,
            ST_AsWKB(geom) AS geom
          FROM airports
          WHERE scalerank <= 3
        `,
        geometryEncodingHint: 'wkb',
      },
    }),
    [],
  );

  return (
    <DeckJsonMap
      className="h-full w-full"
      spec={AIRPORT_MAP_SPEC}
      datasets={datasets}
      mapStyle={MAP_STYLE}
      deckProps={{
        onClick: (info: MapPickingInfo) =>
          setSelected((info.object as AirportRow | null | undefined) ?? null),
        getTooltip: ({object}: MapPickingInfo) =>
          object
            ? {
                text: `${String((object as AirportRow).name)} (${String(
                  (object as AirportRow).abbrev,
                )})`,
              }
            : null,
      }}
    >
      <NavigationControl position="top-left" />
      {selected ? (
        <Popup
          anchor="bottom"
          closeOnClick={false}
          latitude={selected.latitude}
          longitude={selected.longitude}
          onClose={() => setSelected(null)}
        >
          <div className="min-w-32 text-slate-900">
            <div className="font-semibold">{selected.name}</div>
            <div className="text-sm text-slate-600">{selected.abbrev}</div>
          </div>
        </Popup>
      ) : null}
    </DeckJsonMap>
  );
};
