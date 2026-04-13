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
  createRoomShellSlice,
  createRoomStore,
  MAIN_VIEW,
  type RoomShellSliceState,
} from '@sqlrooms/room-shell';
import {
  createSqlEditorSlice,
  type SqlEditorSliceState,
} from '@sqlrooms/sql-editor';
import {Globe} from 'lucide-react';

// Combined room state type
export type RoomState = RoomShellSliceState &
  CesiumSliceState &
  SqlEditorSliceState;

const OPENSKY_FLIGHTS_URL =
  import.meta.env.VITE_OPENSKY_FLIGHTS_URL ??
  'https://pub-334685c2155547fab4287d84cae47083.r2.dev/opensky/opensky_flights_cesium_mosaic_sampled_every10th.parquet';
const OPENSKY_FLIGHT_POINTS_URL =
  import.meta.env.VITE_OPENSKY_POINTS_URL ??
  'https://pub-334685c2155547fab4287d84cae47083.r2.dev/opensky/opensky_flight_points_cesium_sampled_every10th.parquet';
const AIRLINER_MODEL_URL =
  import.meta.env.VITE_OPENSKY_AIRLINER_MODEL_URL ??
  'https://pub-334685c2155547fab4287d84cae47083.r2.dev/opensky/Airliner.glb';

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
        sqlQuery: `
          SELECT
            flight_id AS entity_id,
            longitude,
            latitude,
            altitude_m AS altitude,
            strftime(point_time_utc, '%Y-%m-%dT%H:%M:%SZ') AS timestamp,
            heading,
            CASE
              WHEN altitude_m >= 10000 THEN '#7dd3fc'
              WHEN altitude_m >= 6000 THEN '#34d399'
              WHEN altitude_m >= 3000 THEN '#fbbf24'
              ELSE '#f97316'
            END AS color,
            greatest(2.8, least(5.2, altitude_m / 2800.0)) AS size,
            callsign ||
              ' ' ||
              coalesce(departure_airport, '???') ||
              ' -> ' ||
              coalesce(arrival_airport, '???') AS label
          FROM opensky_flight_points
          WHERE departure_airport IS NOT NULL
            AND arrival_airport IS NOT NULL
            AND duration_s >= 3600
            AND track_points >= 80
            AND onground = false
            AND (sampled_point_index % 2) = 1
            AND (flight_id % 50) = 0
          ORDER BY point_time_utc
        `,
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
        panels: {
          [MAIN_VIEW]: {
            title: '3D Globe',
            icon: Globe,
            component: CesiumPanel,
            placement: 'main',
          },
        },
      },
    })(set, get, store),

    ...createCesiumSlice(configWithLayers)(set, get, store),

    ...createSqlEditorSlice()(set, get, store),
  }),
);
