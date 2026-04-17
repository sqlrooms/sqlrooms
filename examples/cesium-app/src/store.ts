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
 * projected into altitude_m = -depth * 1000 so events sit at their true
 * 3D position inside the Earth; depthTestAgainstTerrain stays on so the
 * opaque globe occludes them until a preset's section-cut clipping plane
 * exposes the subsurface.
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
  EARTHQUAKE_TABLE,
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
    // Topography occludes the point cloud: subsurface events are hidden
    // behind the globe until a preset cuts it open with a clipping plane,
    // which then exposes a clean cross-section of the seismicity.
    depthTestAgainstTerrain: true,
    // Keep the timeline + animation controls visible for time scrubbing.
    showTimeline: true,
    showAnimation: true,
    layers: [
      {
        id: EARTHQUAKE_LAYER_ID,
        type: 'sql-entities' as const,
        visible: true,
        tableName: EARTHQUAKE_TABLE,
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
            tableName: EARTHQUAKE_TABLE,
            type: 'url',
            // Pre-built parquet of M5+ global events since 2013 (~17k rows,
            // ~850 KB). Matches the other sqlrooms examples' pattern of
            // loading demo data from HuggingFace rather than bundling in
            // the repo. Regenerate + reupload with
            // `scripts/fetch-earthquakes.py` when you want fresher data.
            url: 'https://huggingface.co/datasets/collord/globalearthquakes/resolve/main/earthquakes.parquet',
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
