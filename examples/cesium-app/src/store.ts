/**
 * Room store configuration for the Wadati–Benioff Earthquake Explorer.
 *
 * Composes four slices:
 *   - RoomShell slice (config, data sources, tasks)
 *   - Cesium slice (3D globe, clock, layers, camera)
 *   - SqlEditor slice (ad-hoc querying)
 *   - Earthquake slice (subduction-zone presets + slab slice filter)
 *
 * The earthquake slice drives the Cesium layer's SQL via updateLayer(), so
 * activating a preset causes an automatic re-query and re-render. Depth is
 * projected into altitude_m = -Depth * 1000, and the viewer is configured
 * with depthTestAgainstTerrain = false so events render inside the Earth.
 */

import {
  createRoomStore,
  createRoomShellSlice,
  type RoomShellSliceState,
  MAIN_VIEW,
  LayoutTypes,
} from '@sqlrooms/room-shell';
import {
  createCesiumSlice,
  type CesiumSliceState,
  createDefaultCesiumConfig,
  CesiumPanel,
} from '@sqlrooms/cesium';
import {createWasmDuckDbConnector} from '@sqlrooms/duckdb';
import {
  createSqlEditorSlice,
  type SqlEditorSliceState,
} from '@sqlrooms/sql-editor';
import {BarChart3, Globe, Waves} from 'lucide-react';
import {
  buildEarthquakeSql,
  createEarthquakeSlice,
  EARTHQUAKE_LAYER_ID,
  type EarthquakeSliceState,
} from './earthquake-slice';
import {PresetPanel} from './PresetPanel';
import {HistogramPanel} from './HistogramPanel';
import {EarthquakePanels} from './panel-keys';

export type RoomState = RoomShellSliceState &
  CesiumSliceState &
  SqlEditorSliceState &
  EarthquakeSliceState;

const cesiumConfig = createDefaultCesiumConfig();

const configWithLayers = {
  ...cesiumConfig,
  cesium: {
    ...cesiumConfig.cesium,
    // Start the camera well above the Pacific Ring of Fire so you immediately
    // see how seismicity outlines the trenches at a global scale.
    camera: {
      longitude: 150,
      latitude: 0,
      height: 20_000_000,
      heading: 0,
      pitch: -Math.PI / 2,
      roll: 0,
    },
    // CRITICAL: allow sub-surface rendering so depth-positioned points are
    // not culled by the terrain depth test.
    depthTestAgainstTerrain: false,
    // Keep the timeline + animation controls visible for time scrubbing.
    showTimeline: true,
    showAnimation: true,
    layers: [
      {
        id: EARTHQUAKE_LAYER_ID,
        type: 'sql-entities' as const,
        visible: true,
        tableName: 'earthquakes',
        sqlQuery: buildEarthquakeSql(''),
        // `NONE` means the altitude column is used verbatim; no terrain snap.
        heightReference: 'NONE' as const,
        columnMapping: {
          longitude: 'longitude',
          latitude: 'latitude',
          altitude: 'altitude_m',
          time: 'timestamp',
          color: 'color',
          size: 'size',
          label: 'label',
        },
      },
    ],
    clock: {
      multiplier: 86400 * 7, // 1 week per second — fast enough to see patterns
      shouldAnimate: false,
      clockRange: 'LOOP_STOP' as const,
    },
  },
};

const connector = createWasmDuckDbConnector();

export const {roomStore, useRoomStore} = createRoomStore<RoomState>(
  (set, get, store) => ({
    ...createRoomShellSlice({
      connector,
      config: {
        title: 'Wadati–Benioff Explorer',
        dataSources: [
          {
            tableName: 'earthquakes',
            type: 'url',
            url: 'https://huggingface.co/datasets/sqlrooms/earthquakes/resolve/main/earthquakes.parquet',
          },
        ],
      },
      layout: {
        config: {
          type: LayoutTypes.enum.mosaic,
          nodes: {
            direction: 'row',
            splitPercentage: 22,
            first: EarthquakePanels.Presets,
            second: {
              direction: 'column',
              splitPercentage: 68,
              first: MAIN_VIEW,
              second: EarthquakePanels.Histogram,
            },
          },
        },
        panels: {
          [EarthquakePanels.Presets]: {
            title: 'Subduction Zones',
            icon: Waves,
            component: PresetPanel,
            placement: 'sidebar',
          },
          [MAIN_VIEW]: {
            title: '3D Globe',
            icon: Globe,
            component: CesiumPanel,
            placement: 'main',
          },
          [EarthquakePanels.Histogram]: {
            title: 'Mag vs Depth',
            icon: BarChart3,
            component: HistogramPanel,
            placement: 'sidebar-bottom',
          },
        },
      },
    })(set, get, store),

    ...createCesiumSlice(configWithLayers)(set, get, store),

    ...createSqlEditorSlice()(set, get, store),

    ...createEarthquakeSlice()(set, get, store),
  }),
);
