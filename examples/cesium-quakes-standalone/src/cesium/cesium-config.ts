/**
 * Zod configuration schemas for the inlined Cesium integration.
 * Defines all persistable state for the Cesium 3D globe visualization.
 *
 * CRITICAL: Only serializable primitives allowed here. No Cesium class instances
 * (Viewer, Entity, JulianDate) as they break localStorage persistence.
 */

import {z} from 'zod';

/**
 * Camera position in cartographic coordinates (serializable).
 * Longitude/latitude in degrees; heading/pitch/roll in radians; distances in meters.
 */
export const CameraPosition = z.object({
  /** Longitude in degrees */
  longitude: z.number().default(-98.5795),
  /** Latitude in degrees */
  latitude: z.number().default(39.8283),
  /** Height above ellipsoid in meters */
  height: z.number().default(15000000),
  /** Camera heading (rotation around up axis) in radians */
  heading: z.number().default(0),
  /** Camera pitch (rotation around right axis) in radians, negative is looking down */
  pitch: z.number().default(-Math.PI / 2),
  /** Camera roll (rotation around forward axis) in radians */
  roll: z.number().default(0),
});

export type CameraPosition = z.infer<typeof CameraPosition>;

/**
 * Clock configuration for time-dynamic data visualization.
 * Times stored as ISO 8601 strings for serialization (not JulianDate instances).
 */
export const ClockConfig = z.object({
  /** Animation start time in ISO 8601 format */
  startTime: z.string().optional(),
  /** Animation stop time in ISO 8601 format */
  stopTime: z.string().optional(),
  /** Current time in ISO 8601 format */
  currentTime: z.string().optional(),
  /** Time multiplier (1.0 = real-time, 10 = 10x speed) */
  multiplier: z.number().default(1),
  /** Whether animation should be playing */
  shouldAnimate: z.boolean().default(false),
  /** Clock behavior at end of range */
  clockRange: z
    .enum(['UNBOUNDED', 'CLAMPED', 'LOOP_STOP'])
    .default('LOOP_STOP'),
});

export type ClockConfig = z.infer<typeof ClockConfig>;

/**
 * Column mapping configuration for SQL-based entity layers.
 * Maps SQL column names to Cesium entity properties.
 */
export const ColumnMapping = z.object({
  /** Column containing longitude in degrees */
  longitude: z.string().default('longitude'),
  /** Column containing latitude in degrees */
  latitude: z.string().default('latitude'),
  /** Optional column for altitude/height in meters */
  altitude: z.string().optional(),
  /** Optional column for time-dynamic positioning (ISO 8601 string) */
  time: z.string().optional(),
  /** Optional column for entity label/name */
  label: z.string().optional(),
  /** Optional column for color (CSS color string or hex) */
  color: z.string().optional(),
  /** Optional column for point size/scale */
  size: z.string().optional(),
});

export type ColumnMapping = z.infer<typeof ColumnMapping>;

/**
 * Layer definition that can be persisted.
 * Supports multiple layer types: sql-entities, geojson, czml, tileset.
 */
export const CesiumLayerConfig = z.object({
  /** Unique layer identifier */
  id: z.string(),
  /** Layer type determines rendering strategy */
  type: z.enum(['geojson', 'czml', 'sql-entities', 'tileset']),
  /** Whether layer is currently visible */
  visible: z.boolean().default(true),
  /** SQL query for sql-entities type (results become entities) */
  sqlQuery: z.string().optional(),
  /** DuckDB table name queried by this layer (used to gate query on table existence) */
  tableName: z.string().optional(),
  /** Column mappings for sql-entities layers */
  columnMapping: ColumnMapping.optional(),
  /** URL for geojson/czml data sources or inline data reference */
  dataUrl: z.string().optional(),
  /** URL for 3D Tiles tileset */
  tilesetUrl: z.string().optional(),
  /** Height reference mode for entity positioning */
  heightReference: z
    .enum(['CLAMP_TO_GROUND', 'RELATIVE_TO_GROUND', 'NONE'])
    .default('RELATIVE_TO_GROUND'),
});

export type CesiumLayerConfig = z.infer<typeof CesiumLayerConfig>;

/**
 * Top-level Cesium slice configuration (persisted to localStorage).
 * Combines camera, clock, layers, and scene settings.
 */
export const CesiumSliceConfig = z.object({
  cesium: z.object({
    /** Camera position and orientation */
    camera: CameraPosition,
    /** Clock/timeline configuration */
    clock: ClockConfig,
    /** Array of configured layers */
    layers: z.array(CesiumLayerConfig).default([]),
    /** Enable global terrain (requires Cesium Ion) */
    terrain: z.boolean().default(true),
    /** Scene viewing mode */
    sceneMode: z
      .enum(['SCENE3D', 'SCENE2D', 'COLUMBUS_VIEW'])
      .default('SCENE3D'),
    /** Show timeline widget at bottom */
    showTimeline: z.boolean().default(true),
    /** Show animation widget (play/pause controls) */
    showAnimation: z.boolean().default(true),
    /** Base imagery provider selection */
    baseLayerImagery: z
      .enum(['ion-default', 'openstreetmap', 'none'])
      .default('ion-default'),
    /** Whether to depth-test entities against terrain (false allows subsurface rendering) */
    depthTestAgainstTerrain: z.boolean().default(true),
  }),
});

export type CesiumSliceConfig = z.infer<typeof CesiumSliceConfig>;

/**
 * Default Cesium configuration values.
 */
const DEFAULT_CESIUM_CONFIG: CesiumSliceConfig = {
  cesium: {
    camera: {
      longitude: -98.5795, // Center of USA
      latitude: 39.8283,
      height: 15000000, // ~15,000 km altitude
      heading: 0,
      pitch: -Math.PI / 2, // Looking straight down
      roll: 0,
    },
    clock: {
      multiplier: 1,
      shouldAnimate: false,
      clockRange: 'LOOP_STOP',
    },
    layers: [],
    terrain: true,
    sceneMode: 'SCENE3D',
    showTimeline: true,
    showAnimation: true,
    baseLayerImagery: 'ion-default',
    depthTestAgainstTerrain: true,
  },
};

/**
 * Factory function for creating default Cesium configuration.
 * Returns a fresh deep clone so callers can safely mutate the result
 * without affecting the shared defaults.
 */
export function createDefaultCesiumConfig(): CesiumSliceConfig {
  return structuredClone(DEFAULT_CESIUM_CONFIG);
}
