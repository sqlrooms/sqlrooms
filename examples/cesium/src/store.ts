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

const MAX_RENDERED_FLIGHTS = 2000;
const OPENSKY_NYC_TABLE_NAME = 'opensky_nyc_flight_points';

export const OPENSKY_POINT_PROFILER_COLUMNS = [
  'callsign',
  'nyc_role',
  'departure_airport',
  'arrival_airport',
  'point_time_ny',
  'altitude_m',
  'heading_deg',
  'speed_knots',
  'duration_s',
  'first_seen_ny',
  'last_seen_ny',
] as const;

const OPENSKY_FLIGHT_POINTS_URL =
  import.meta.env.VITE_OPENSKY_POINTS_URL ??
  'https://pub-334685c2155547fab4287d84cae47083.r2.dev/opensky/opensky_nyc_area_flight_points_2026-03-01_ny.parquet';
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
  const query = Query.from(OPENSKY_NYC_TABLE_NAME)
    .select('flight_id')
    .distinct()
    .where(
      sql`"onground" = false`,
      sql`"speed_knots" IS NULL OR "speed_knots" <= 700`,
    );

  return appendSelectionFilter(query, filter).toString();
}

function buildSelectedFlightsSubquery(filter?: unknown) {
  return `
    SELECT flight_id
    FROM ${OPENSKY_NYC_TABLE_NAME}
    WHERE
      departure_airport IS NOT NULL
      AND arrival_airport IS NOT NULL
      AND duration_s >= 1200
      AND flight_id IN (
        ${buildMatchedPointFlightsSubquery(filter)}
      )
    GROUP BY flight_id, duration_s
    ORDER BY duration_s DESC, flight_id
    LIMIT ${MAX_RENDERED_FLIGHTS}
  `;
}

export function buildOpenSkyFlightPointsQuery(filter?: unknown) {
  return `
    WITH selected_flights AS (
      ${buildSelectedFlightsSubquery(filter)}
    )
    SELECT
      p.flight_id AS entity_id,
      p.longitude,
      p.latitude,
      p.altitude_m AS altitude,
      strftime(p.point_time_utc, '%Y-%m-%dT%H:%M:%SZ') AS timestamp,
      p.heading_deg AS heading,
      CASE
        WHEN p.altitude_m >= 10000 THEN '#7dd3fc'
        WHEN p.altitude_m >= 6000 THEN '#34d399'
        WHEN p.altitude_m >= 3000 THEN '#fbbf24'
        ELSE '#f97316'
      END AS color,
      greatest(2.8, least(5.2, p.altitude_m / 2800.0)) AS size,
      coalesce(nullif(p.callsign, ''), p.icao24, 'unknown') ||
        ' ' ||
        coalesce(p.departure_airport, '???') ||
        ' -> ' ||
        coalesce(p.arrival_airport, '???') ||
        CASE
          WHEN p.speed_knots IS NOT NULL
            THEN ' • ' || cast(round(p.speed_knots) AS VARCHAR) || ' kt'
          ELSE ''
        END AS label
    FROM ${OPENSKY_NYC_TABLE_NAME} AS p
    JOIN selected_flights AS f
      ON p.flight_id = f.flight_id
    WHERE
      p.onground = false
      AND (p.speed_knots IS NULL OR p.speed_knots <= 700)
      AND (p.point_index = 1 OR (p.point_index % 2) = 1)
    ORDER BY p.point_time_utc
  `;
}

// Create default Cesium configuration with a manageable global flights layer.
const cesiumConfig = createDefaultCesiumConfig();

const configWithLayers = {
  ...cesiumConfig,
  cesium: {
    ...cesiumConfig.cesium,
    camera: {
      longitude: -71.82,
      latitude: 41.74,
      height: 50000,
      heading: -90,
      pitch: -0.32,
      roll: 0,
    },
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
        modelScale: 9,
        modelMinimumPixelSize: 14,
        modelOrientationOffset: {
          heading: 90,
          pitch: 90,
          roll: 0,
        },
        tableName: OPENSKY_NYC_TABLE_NAME,
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
      currentTime: '2026-03-01T17:00:00Z',
      multiplier: 60, // 1 minute per second
      shouldAnimate: true,
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
            tableName: OPENSKY_NYC_TABLE_NAME,
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
