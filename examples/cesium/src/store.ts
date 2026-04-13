/**
 * Room store configuration for the Cesium OpenSky flights example.
 * Demonstrates Cesium globe playback with hosted OpenSky parquet data.
 */

import {
  CesiumPanel,
  createCesiumSlice,
  createDefaultCesiumConfig,
  type CesiumSliceState,
} from '@sqlrooms/cesium';
import {createWasmDuckDbConnector} from '@sqlrooms/duckdb';
import {
  createMosaicSlice,
  Query,
  sql,
  type MosaicSliceState,
} from '@sqlrooms/mosaic';
import {
  createRoomShellSlice,
  createRoomStore,
  LayoutTypes,
  MAIN_VIEW,
  type RoomShellSliceState,
} from '@sqlrooms/room-shell';
import {
  createSqlEditorSlice,
  type SqlEditorSliceState,
} from '@sqlrooms/sql-editor';
import {FilterIcon, Globe} from 'lucide-react';
import {FlightsProfilerPanel} from './components/FlightsProfilerPanel';

// Combined room state type
export type RoomState = RoomShellSliceState &
  CesiumSliceState &
  MosaicSliceState &
  SqlEditorSliceState;

export const FLIGHT_FILTER_SELECTION_NAME = 'flight_filter';

const MAX_RENDERED_FLIGHTS = 2500;

export const OPENSKY_POINT_PROFILER_COLUMNS = [
  'callsign',
  'departure_airport',
  'arrival_airport',
  'point_time_utc',
  'altitude_m',
  'heading',
  'duration_s',
  'track_points',
  'sampled_point_index',
  'first_seen_utc',
  'last_seen_utc',
] as const;

const OPENSKY_FLIGHTS_URL =
  import.meta.env.VITE_OPENSKY_FLIGHTS_URL ??
  'https://pub-334685c2155547fab4287d84cae47083.r2.dev/opensky/opensky_flights_cesium_mosaic_sampled_every10th.parquet';
const OPENSKY_FLIGHT_POINTS_URL =
  import.meta.env.VITE_OPENSKY_POINTS_URL ??
  'https://pub-334685c2155547fab4287d84cae47083.r2.dev/opensky/opensky_flight_points_cesium_sampled_every10th.parquet';
const AIRLINER_MODEL_URL =
  import.meta.env.VITE_OPENSKY_AIRLINER_MODEL_URL ??
  'https://pub-334685c2155547fab4287d84cae47083.r2.dev/opensky/Airliner.glb';

function appendSelectionFilter(
  query: ReturnType<typeof Query.from>,
  filter?: unknown,
) {
  if (Array.isArray(filter)) {
    const clauses = filter.filter(Boolean);
    if (clauses.length > 0) {
      query.where(...(clauses as any[]));
    }
    return query;
  }

  if (filter) {
    query.where(filter as any);
  }

  return query;
}

function buildMatchedPointFlightsSubquery(filter?: unknown) {
  const query = Query.from('opensky_flight_points')
    .select('flight_id')
    .distinct()
    .where(sql`"onground" = false`);

  return appendSelectionFilter(query, filter).toString();
}

function buildFilteredFlightsSubquery(filter?: unknown) {
  return `
    SELECT flight_id
    FROM opensky_flights
    WHERE
      departure_airport IS NOT NULL
      AND arrival_airport IS NOT NULL
      AND duration_s >= 1800
      AND track_points >= 40
      AND flight_id IN (
        ${buildMatchedPointFlightsSubquery(filter)}
      )
    ORDER BY duration_s DESC, track_points DESC, flight_id
    LIMIT ${MAX_RENDERED_FLIGHTS}
  `;
}

export function buildOpenSkyFlightPointsQuery(filter?: unknown) {
  return `
    WITH filtered_flights AS (
      ${buildFilteredFlightsSubquery(filter)}
    )
    SELECT
      p.flight_id AS entity_id,
      p.longitude,
      p.latitude,
      p.altitude_m AS altitude,
      strftime(p.point_time_utc, '%Y-%m-%dT%H:%M:%SZ') AS timestamp,
      p.heading,
      CASE
        WHEN p.altitude_m >= 10000 THEN '#7dd3fc'
        WHEN p.altitude_m >= 6000 THEN '#34d399'
        WHEN p.altitude_m >= 3000 THEN '#fbbf24'
        ELSE '#f97316'
      END AS color,
      greatest(2.8, least(5.2, p.altitude_m / 2800.0)) AS size,
      p.callsign ||
        ' ' ||
        coalesce(p.departure_airport, '???') ||
        ' -> ' ||
        coalesce(p.arrival_airport, '???') AS label
    FROM opensky_flight_points AS p
    JOIN filtered_flights AS f
      ON p.flight_id = f.flight_id
    WHERE
      p.onground = false
      AND (p.sampled_point_index % 2) = 1
    ORDER BY p.point_time_utc
  `;
}

// Create default Cesium configuration with a manageable global flights layer.
const cesiumConfig = createDefaultCesiumConfig();

const configWithLayers = {
  ...cesiumConfig,
  cesium: {
    ...cesiumConfig.cesium,
    terrain: false,
    baseLayerImagery: 'openstreetmap' as const,
    depthTestAgainstTerrain: false,
    layers: [
      {
        id: 'opensky-flights',
        type: 'sql-entities' as const,
        visible: true,
        heightReference: 'NONE' as const,
        entityStyle: 'model' as const,
        billboardScale: 1,
        geometryScale: 1,
        modelUri: AIRLINER_MODEL_URL,
        modelScale: 24,
        modelMinimumPixelSize: 24,
        modelOrientationOffset: {
          heading: 90,
          pitch: 90,
          roll: 0,
        },
        tableName: 'opensky_flight_points',
        sqlQuery: buildOpenSkyFlightPointsQuery(),
        columnMapping: {
          id: 'entity_id',
          longitude: 'longitude',
          latitude: 'latitude',
          altitude: 'altitude',
          time: 'timestamp',
          label: 'label',
          color: 'color',
          heading: 'heading',
          size: 'size',
        },
      },
    ],
    clock: {
      currentTime: '2026-03-01T12:00:00Z',
      multiplier: 3600, // 1 hour per second
      shouldAnimate: false,
      clockRange: 'LOOP_STOP' as const,
    },
  },
};

// Create DuckDB connector
const connector = createWasmDuckDbConnector();

// Create room store with Cesium slice
export const {roomStore, useRoomStore} = createRoomStore<RoomState>(
  (set, get, store) => ({
    ...createRoomShellSlice({
      connector,
      config: {
        title: 'OpenSky Flights Explorer',
        dataSources: [
          {
            tableName: 'opensky_flights',
            type: 'url',
            url: OPENSKY_FLIGHTS_URL,
          },
          {
            tableName: 'opensky_flight_points',
            type: 'url',
            url: OPENSKY_FLIGHT_POINTS_URL,
          },
        ],
      },
      layout: {
        config: {
          type: LayoutTypes.enum.mosaic,
          nodes: {
            direction: 'column',
            first: MAIN_VIEW,
            second: 'filters',
            splitPercentage: 70,
          },
        },
        panels: {
          filters: {
            title: 'Flight Filters',
            icon: FilterIcon,
            component: FlightsProfilerPanel,
            placement: 'sidebar',
          },
          [MAIN_VIEW]: {
            title: '3D Globe',
            icon: Globe,
            component: CesiumPanel,
            placement: 'main',
          },
        },
      },
    })(set, get, store),

    ...createMosaicSlice()(set, get, store),

    ...createCesiumSlice(configWithLayers)(set, get, store),

    ...createSqlEditorSlice()(set, get, store),
  }),
);
