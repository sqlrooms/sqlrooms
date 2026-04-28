import {DeckJsonMap} from '@sqlrooms/deck';
import type {
  DeckDatasetInput,
  DeckJsonMapProps,
  PreparedDeckDatasetState,
} from '@sqlrooms/deck';
import {useCallback, useMemo, useState} from 'react';
import {NavigationControl} from 'react-map-gl/maplibre';
import {BUILDINGS_TABLE_NAME} from '../dataSources';

const ZURICH_VIEW_STATE = {
  latitude: 47.376,
  longitude: 8.535,
  zoom: 13,
  bearing: -20,
  pitch: 60,
};

const AIRPORTS_VIEW_STATE = {
  latitude: 18,
  longitude: 5,
  zoom: 1.35,
  bearing: 0,
  pitch: 0,
};

const MAP_STYLE =
  'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

const BUILDINGS_QUERY = `
  SELECT
    class,
    height,
    geometry
  FROM ${BUILDINGS_TABLE_NAME}
`;

const AIRPORTS_QUERY = `
  SELECT
    name,
    abbrev,
    scalerank,
    ST_X(geom) AS longitude,
    ST_Y(geom) AS latitude,
    ST_AsWKB(geom) AS geom
  FROM airports
`;

const MAJOR_AIRPORTS_QUERY = `
  SELECT
    name,
    abbrev,
    scalerank,
    ST_X(geom) AS longitude,
    ST_Y(geom) AS latitude,
    ST_AsWKB(geom) AS geom
  FROM airports
  WHERE scalerank <= 3
`;

const BUILDINGS_LAYERS = [
  {
    '@@type': 'GeoArrowPolygonLayer',
    id: 'buildings',
    _sqlroomsBinding: {dataset: 'buildings'},
    pickable: true,
    filled: true,
    stroked: false,
    extruded: true,
    getElevation: '@@=height',
    getFillColor: {
      '@@function': 'colorScale',
      type: 'sequential',
      field: 'height',
      legend: {
        title: 'Height (m)',
      },
      scheme: 'Blues',
      domain: [0.003950834274291992, 186.7],
      clamp: true,
      reverse: true,
    },
  },
];

const AIRPORT_LAYERS = [
  {
    '@@type': 'GeoArrowScatterplotLayer',
    id: 'airports',
    _sqlroomsBinding: {dataset: 'airports'},
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
    _sqlroomsBinding: {dataset: 'majorAirports'},
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
];

type ActiveLayer = 'buildings' | 'airports';

type BuildingRow = {
  class: string | null;
  height: number | null;
};

type AirportRow = {
  name: string | null;
  abbrev: string | null;
};

function StatusIndicator({
  status,
}: {
  status: PreparedDeckDatasetState['status'];
}) {
  if (status === 'loading') {
    return (
      <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
    );
  }
  if (status === 'error') {
    return (
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-400" />
    );
  }
  return null;
}

export const MapView = () => {
  const [activeLayer, setActiveLayer] = useState<ActiveLayer>('buildings');
  const [datasetStates, setDatasetStates] = useState<
    Record<string, PreparedDeckDatasetState>
  >({});

  const datasets = useMemo<Record<string, DeckDatasetInput>>(() => {
    if (activeLayer === 'airports') {
      const airportDatasets: Record<string, DeckDatasetInput> = {
        airports: {sqlQuery: AIRPORTS_QUERY, geometryEncodingHint: 'wkb'},
        majorAirports: {
          sqlQuery: MAJOR_AIRPORTS_QUERY,
          geometryEncodingHint: 'wkb',
        },
      };
      return airportDatasets;
    }

    const buildingDatasets: Record<string, DeckDatasetInput> = {
      buildings: {sqlQuery: BUILDINGS_QUERY, geometryEncodingHint: 'wkb'},
    };
    return buildingDatasets;
  }, [activeLayer]);

  const spec = useMemo(
    () => ({
      initialViewState:
        activeLayer === 'airports' ? AIRPORTS_VIEW_STATE : ZURICH_VIEW_STATE,
      controller: true,
      layers: activeLayer === 'airports' ? AIRPORT_LAYERS : BUILDINGS_LAYERS,
    }),
    [activeLayer],
  );

  const handleDatasetStatesChange = useCallback(
    (states: Record<string, PreparedDeckDatasetState>) => {
      setDatasetStates(states);
    },
    [],
  );

  const deckProps = useMemo<DeckJsonMapProps['deckProps']>(
    () => ({
      getTooltip: ({object}: {object?: unknown}) => {
        if (!object) return null;

        if (activeLayer === 'airports') {
          const row = object as AirportRow;
          if (!row.name && !row.abbrev) return null;
          if (row.name && row.abbrev) {
            return {text: `${row.name} (${row.abbrev})`};
          }
          return {text: row.name ?? row.abbrev ?? ''};
        }

        const row = object as BuildingRow;
        const lines: string[] = [];
        if (row.class) lines.push(row.class);
        if (row.height != null) lines.push(`${row.height.toFixed(1)} m`);
        return lines.length ? {text: lines.join('\n')} : null;
      },
    }),
    [activeLayer],
  );

  const buildingState = datasetStates['buildings'];
  const airportsState = datasetStates['airports'];
  const majorAirportsState = datasetStates['majorAirports'];
  const airportsStatus = majorAirportsState ?? airportsState;

  const buildingCount =
    buildingState?.status === 'ready'
      ? buildingState.prepared.table.numRows
      : 48451;
  const airportCount =
    airportsState?.status === 'ready'
      ? airportsState.prepared.table.numRows
      : null;

  return (
    <div className="relative h-full w-full">
      <DeckJsonMap
        className="absolute inset-0"
        spec={spec}
        datasets={datasets}
        mapStyle={MAP_STYLE}
        onDatasetStatesChange={handleDatasetStatesChange}
        deckProps={deckProps}
      >
        <NavigationControl position="top-left" />
      </DeckJsonMap>

      <div className="pointer-events-none absolute inset-0 z-20">
        <div className="pointer-events-auto absolute top-3 right-3 w-72 overflow-hidden border border-white/10 bg-black/70 shadow-2xl backdrop-blur-md">
          <div className="border-b border-white/8 px-4 py-3">
            <p className="mt-0.5 text-[11px] text-white/40">Dataset Mode</p>
          </div>

          <div className="space-y-1.5 px-4 py-3">
            <label className="flex cursor-pointer items-start gap-3 select-none">
              <div className="mt-0.5 flex-shrink-0">
                <input
                  type="radio"
                  name="map-layer"
                  checked={activeLayer === 'buildings'}
                  onChange={() => setActiveLayer('buildings')}
                  className="accent-blue-400"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-white/85">
                    Zurich Buildings ({buildingCount.toLocaleString()})
                  </span>
                  {activeLayer === 'buildings' && buildingState && (
                    <StatusIndicator status={buildingState.status} />
                  )}
                </div>
                <p className="mt-0.5 text-[11px] leading-tight text-white/40">
                  Hugging Face-hosted Overture subset of Zurich urban core
                  footprints
                </p>
              </div>
            </label>

            <label className="flex cursor-pointer items-start gap-3 select-none">
              <div className="mt-0.5 flex-shrink-0">
                <input
                  type="radio"
                  name="map-layer"
                  checked={activeLayer === 'airports'}
                  onChange={() => setActiveLayer('airports')}
                  className="accent-orange-400"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-white/85">
                    Airports
                    {airportCount != null
                      ? ` (${airportCount.toLocaleString()})`
                      : ''}
                  </span>
                  {activeLayer === 'airports' && airportsStatus && (
                    <StatusIndicator status={airportsStatus.status} />
                  )}
                </div>
                <p className="mt-0.5 text-[11px] leading-tight text-white/40">
                  Natural Earth airports, plus highlighted major airports
                </p>
              </div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
