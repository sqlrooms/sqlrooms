import type {ColorScaleConfig, ColorScaleScheme} from '@sqlrooms/color-scales';
import type {DeckMapConfig} from './mapConfig';
import type {DeckAutoLayerType} from './types';
import {isColorScaleFunction} from './json/layerConfig';

export type DeckMapLayerRecord = Record<string, unknown>;

export type DeckMapLayerColorScaleFunction = ColorScaleConfig & {
  '@@function': 'colorScale';
};

export type DeckMapLayerColorAccessor =
  | 'getFillColor'
  | 'getLineColor'
  | 'getColor'
  | 'getSourceColor'
  | 'getTargetColor';

export const DECK_MAP_LAYER_TYPE_OPTIONS: ReadonlyArray<{
  value: DeckAutoLayerType;
  label: string;
}> = [
  {value: 'GeoArrowScatterplotLayer', label: 'Point'},
  {value: 'GeoArrowHeatmapLayer', label: 'Heatmap'},
  {value: 'GeoArrowColumnLayer', label: 'Column'},
  {value: 'GeoArrowPathLayer', label: 'Path'},
  {value: 'GeoArrowPolygonLayer', label: 'Polygon'},
  {value: 'GeoArrowSolidPolygonLayer', label: 'Solid polygon'},
  {value: 'GeoArrowArcLayer', label: 'Arc'},
  {value: 'GeoArrowTripsLayer', label: 'Trips'},
  {value: 'GeoArrowH3HexagonLayer', label: 'H3 hexagon'},
  {value: 'GeoJsonLayer', label: 'GeoJSON'},
];

export const DECK_MAP_COLOR_ACCESSOR_OPTIONS: ReadonlyArray<{
  value: DeckMapLayerColorAccessor;
  label: string;
}> = [
  {value: 'getFillColor', label: 'Fill color'},
  {value: 'getLineColor', label: 'Line color'},
  {value: 'getColor', label: 'Color'},
  {value: 'getSourceColor', label: 'Source color'},
  {value: 'getTargetColor', label: 'Target color'},
];

export const DECK_MAP_COLOR_SCALE_TYPE_OPTIONS: ReadonlyArray<{
  value: ColorScaleConfig['type'];
  label: string;
  defaultScheme: ColorScaleScheme;
}> = [
  {value: 'sequential', label: 'Sequential', defaultScheme: 'Viridis'},
  {value: 'diverging', label: 'Diverging', defaultScheme: 'RdBu'},
  {value: 'quantize', label: 'Quantize', defaultScheme: 'YlOrRd'},
  {value: 'quantile', label: 'Quantile', defaultScheme: 'YlOrRd'},
  {value: 'categorical', label: 'Categorical', defaultScheme: 'Tableau10'},
];

const GEOMETRY_COLUMN_LAYER_TYPES = new Set([
  'geoarrowpolygonlayer',
  'geoarrowsolidpolygonlayer',
  'geoarrowpathlayer',
  'geoarrowtripslayer',
  'geojsonlayer',
  'polygonlayer',
  'solidpolygonlayer',
  'geojson',
  'polygon',
  'solid polygon',
]);

const H3_LAYER_TYPES = new Set(['geoarrowh3hexagonlayer', 'h3hexagonlayer']);

const ARC_LAYER_TYPES = new Set(['geoarrowarclayer', 'arclayer']);

const TRIPS_LAYER_TYPES = new Set([
  'geoarrowtripslayer',
  'decktripslayer',
  'tripslayer',
]);

const RADIUS_LAYER_TYPES = new Set([
  'geoarrowscatterplotlayer',
  'scatterplotlayer',
  'geojsonlayer',
]);

const COLUMN_RADIUS_LAYER_TYPES = new Set([
  'geoarrowcolumnlayer',
  'columnlayer',
]);

// GeoJSON: elevation/scale compile is geoarrow-only — no extrusion UI here.
const EXTRUDABLE_LAYER_TYPES = new Set([
  'geoarrowh3hexagonlayer',
  'h3hexagonlayer',
  'geoarrowcolumnlayer',
  'columnlayer',
  'geoarrowpolygonlayer',
  'polygonlayer',
  'geoarrowsolidpolygonlayer',
  'solidpolygonlayer',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function getObjectSpec(
  config: DeckMapConfig,
): Record<string, unknown> | undefined {
  return isRecord(config.spec) ? config.spec : undefined;
}

export function getDeckMapLayerRecords(
  config: DeckMapConfig,
): DeckMapLayerRecord[] {
  const layers = getObjectSpec(config)?.layers;
  return Array.isArray(layers) ? layers.filter(isRecord) : [];
}

export function getDeckMapLayerDatasetId(
  layer: DeckMapLayerRecord | undefined,
): string | undefined {
  const binding = layer?._sqlroomsBinding;
  if (!isRecord(binding)) return undefined;
  return typeof binding.dataset === 'string' ? binding.dataset : undefined;
}

export function usesGeometryColumnSetting(layerType: unknown) {
  return (
    typeof layerType === 'string' &&
    GEOMETRY_COLUMN_LAYER_TYPES.has(layerType.toLowerCase())
  );
}

export function usesH3ColumnSetting(layerType: unknown) {
  return (
    typeof layerType === 'string' && H3_LAYER_TYPES.has(layerType.toLowerCase())
  );
}

export function usesArcColumnSetting(layerType: unknown) {
  return (
    typeof layerType === 'string' &&
    ARC_LAYER_TYPES.has(layerType.toLowerCase())
  );
}

export function usesRadiusSetting(layerType: unknown) {
  return (
    typeof layerType === 'string' &&
    RADIUS_LAYER_TYPES.has(layerType.toLowerCase())
  );
}

export function usesColumnRadiusSetting(layerType: unknown) {
  return (
    typeof layerType === 'string' &&
    COLUMN_RADIUS_LAYER_TYPES.has(layerType.toLowerCase())
  );
}

export function usesTripsSettings(layerType: unknown) {
  return (
    typeof layerType === 'string' &&
    TRIPS_LAYER_TYPES.has(layerType.toLowerCase())
  );
}

export function usesExtrusionSettings(layerType: unknown) {
  return (
    typeof layerType === 'string' &&
    EXTRUDABLE_LAYER_TYPES.has(layerType.toLowerCase())
  );
}

const STROKE_LAYER_TYPES = new Set([
  'geoarrowscatterplotlayer',
  'scatterplotlayer',
  'geoarrowh3hexagonlayer',
  'h3hexagonlayer',
  'geoarrowpolygonlayer',
  'polygonlayer',
  'geoarrowsolidpolygonlayer',
  'solidpolygonlayer',
  'geojsonlayer',
]);

export function usesStrokeSetting(layerType: unknown) {
  return (
    typeof layerType === 'string' &&
    STROKE_LAYER_TYPES.has(layerType.toLowerCase())
  );
}

/**
 * Deck.gl default for `stroked` when the prop is omitted.
 * Scatterplot and solid-polygon default to no stroke; polygon / H3 / GeoJSON stroke by default.
 */
export function getDeckMapLayerStrokeDefault(layerType: unknown): boolean {
  if (typeof layerType !== 'string') return false;
  const type = layerType.toLowerCase();
  if (
    type.includes('scatterplot') ||
    type.includes('solidpolygon') ||
    type === 'solid polygon'
  ) {
    return false;
  }
  return true;
}

export function getDeckMapColorAccessorOptions(
  layerType: unknown,
): typeof DECK_MAP_COLOR_ACCESSOR_OPTIONS {
  if (layerType === 'GeoArrowPathLayer' || layerType === 'GeoArrowTripsLayer') {
    return DECK_MAP_COLOR_ACCESSOR_OPTIONS.filter(
      (option) => option.value === 'getColor',
    );
  }

  if (layerType === 'GeoArrowArcLayer') {
    return DECK_MAP_COLOR_ACCESSOR_OPTIONS.filter(
      (option) =>
        option.value === 'getSourceColor' || option.value === 'getTargetColor',
    );
  }

  if (layerType === 'GeoArrowHeatmapLayer') {
    return [];
  }

  if (layerType === 'GeoArrowColumnLayer') {
    return DECK_MAP_COLOR_ACCESSOR_OPTIONS.filter(
      (option) => option.value === 'getFillColor',
    );
  }

  return DECK_MAP_COLOR_ACCESSOR_OPTIONS.filter(
    (option) =>
      option.value === 'getFillColor' || option.value === 'getLineColor',
  );
}

export function updateDeckMapLayer(
  config: DeckMapConfig,
  layerIndex: number,
  updater: (layer: DeckMapLayerRecord) => DeckMapLayerRecord,
): DeckMapConfig {
  const spec = getObjectSpec(config);
  if (!spec || !Array.isArray(spec.layers)) {
    return config;
  }

  const layer = spec.layers[layerIndex];
  if (!isRecord(layer)) {
    return config;
  }

  return {
    ...config,
    spec: {
      ...spec,
      layers: spec.layers.map((candidate, index) =>
        index === layerIndex ? updater({...layer}) : candidate,
      ),
    },
  };
}

export function setDeckMapLayerType(
  config: DeckMapConfig,
  layerIndex: number,
  layerType: string,
): DeckMapConfig {
  return updateDeckMapLayer(config, layerIndex, (layer) => {
    const nextLayer: DeckMapLayerRecord = {
      ...layer,
      '@@type': layerType,
    };
    const lt = layerType.toLowerCase();
    if (
      lt === 'geoarrowcolumnlayer' ||
      lt === 'columnlayer' ||
      lt === 'deckcolumnlayer'
    ) {
      const radius =
        typeof nextLayer.radius === 'number' &&
        Number.isFinite(nextLayer.radius) &&
        nextLayer.radius > 0
          ? nextLayer.radius
          : 50;
      const withRadius = applyDeckMapColumnRadiusMeters(nextLayer, radius);
      if (typeof withRadius.elevationScale !== 'number') {
        withRadius.elevationScale = 1;
      }
      return withRadius;
    }
    return nextLayer;
  });
}

// Point/heatmap radius leftovers (`getRadius`, pixel units) break ColumnLayer meters UI.
const COLUMN_LAYER_RADIUS_CONFLICT_KEYS = [
  'getRadius',
  'radiusMinPixels',
  'radiusMaxPixels',
  'radiusPixels',
] as const;

/** Force meters and strip point/heatmap radius leftovers (does not set `radius`). */
export function stripDeckMapColumnLayerRadiusConflicts(
  layer: DeckMapLayerRecord,
): DeckMapLayerRecord {
  const next: DeckMapLayerRecord = {
    ...layer,
    radiusUnits: 'meters',
  };
  for (const key of COLUMN_LAYER_RADIUS_CONFLICT_KEYS) {
    delete next[key];
  }
  return next;
}

/** True when ColumnLayer still carries point/heatmap radius props or pixel units. */
export function deckMapColumnLayerHasRadiusConflicts(
  layer: DeckMapLayerRecord,
): boolean {
  if (layer.radiusUnits === 'pixels') return true;
  return COLUMN_LAYER_RADIUS_CONFLICT_KEYS.some(
    (key) => layer[key] !== undefined,
  );
}

/** Apply a column radius in meters and strip conflicting point/heatmap radius props. */
export function applyDeckMapColumnRadiusMeters(
  layer: DeckMapLayerRecord,
  radiusMeters: number,
): DeckMapLayerRecord {
  return {
    ...stripDeckMapColumnLayerRadiusConflicts(layer),
    radius: radiusMeters,
    radiusUnits: 'meters',
  };
}

/** Set GeoArrowColumnLayer disk radius in meters. */
export function setDeckMapLayerColumnRadius(
  config: DeckMapConfig,
  layerIndex: number,
  radiusMeters: number,
): DeckMapConfig {
  return updateDeckMapLayer(config, layerIndex, (layer) =>
    applyDeckMapColumnRadiusMeters(layer, radiusMeters),
  );
}

export function setDeckMapLayerGeometryColumn(
  config: DeckMapConfig,
  layerIndex: number,
  geometryColumn: string,
): DeckMapConfig {
  const layer = getDeckMapLayerRecords(config)[layerIndex];
  const datasetId = getDeckMapLayerDatasetId(layer);
  if (!datasetId || !config.datasets?.[datasetId]) {
    return config;
  }

  const updatedConfig = {
    ...config,
    datasets: {
      ...config.datasets,
      [datasetId]: {
        ...config.datasets[datasetId],
        geometryColumn,
      },
    },
    fitToData:
      config.fitToData &&
      config.fitToData.dataset === datasetId &&
      'geometryColumn' in config.fitToData
        ? {
            ...config.fitToData,
            geometryColumn,
          }
        : config.fitToData,
  };

  return updateDeckMapLayer(updatedConfig, layerIndex, (l) => ({
    ...l,
    _sqlroomsBinding: {
      ...(l._sqlroomsBinding as Record<string, unknown>),
      geometryColumn,
    },
  }));
}

export function setDeckMapLayerHexagonColumn(
  config: DeckMapConfig,
  layerIndex: number,
  hexagonColumn: string,
): DeckMapConfig {
  return updateDeckMapLayer(config, layerIndex, (layer) => ({
    ...layer,
    getHexagon: `@@=${hexagonColumn}`,
    _sqlroomsBinding: {
      ...(isRecord(layer._sqlroomsBinding) ? layer._sqlroomsBinding : {}),
      hexagonColumn,
    },
  }));
}

export function setDeckMapLayerArcColumns(
  config: DeckMapConfig,
  layerIndex: number,
  columns: {
    sourceGeometryColumn?: string;
    targetGeometryColumn?: string;
    sourceLatitudeColumn?: string;
    sourceLongitudeColumn?: string;
    targetLatitudeColumn?: string;
    targetLongitudeColumn?: string;
  },
): DeckMapConfig {
  return updateDeckMapLayer(config, layerIndex, (layer) => ({
    ...layer,
    _sqlroomsBinding: {
      ...(isRecord(layer._sqlroomsBinding) ? layer._sqlroomsBinding : {}),
      ...columns,
    },
  }));
}

export function setDeckMapLayerTimestampColumn(
  config: DeckMapConfig,
  layerIndex: number,
  timestampColumn: string,
): DeckMapConfig {
  return updateDeckMapLayer(config, layerIndex, (layer) => ({
    ...layer,
    _sqlroomsBinding: {
      ...(isRecord(layer._sqlroomsBinding) ? layer._sqlroomsBinding : {}),
      timestampColumn,
    },
  }));
}

export function getDeckMapLayerColorScale(
  layer: DeckMapLayerRecord | undefined,
  accessor: DeckMapLayerColorAccessor,
): DeckMapLayerColorScaleFunction | undefined {
  const value = layer?.[accessor];
  return isColorScaleFunction(value)
    ? (value as DeckMapLayerColorScaleFunction)
    : undefined;
}

export function setDeckMapLayerColorScale(
  config: DeckMapConfig,
  layerIndex: number,
  accessor: DeckMapLayerColorAccessor,
  colorScale: DeckMapLayerColorScaleFunction,
): DeckMapConfig {
  return updateDeckMapLayer(config, layerIndex, (layer) => ({
    ...layer,
    [accessor]: colorScale,
  }));
}

const DEFAULT_LAYER_FILL_COLOR: [number, number, number, number] = [
  56, 189, 248, 180,
];

const DEFAULT_LAYER_STROKE_COLOR: [number, number, number, number] = [
  0, 0, 0, 255,
];

/** Default flat RGBA used when a color scale is cleared / flat fill is unset. */
export const DECK_MAP_DEFAULT_LAYER_COLOR: readonly [
  number,
  number,
  number,
  number,
] = DEFAULT_LAYER_FILL_COLOR;

/** Default stroke outline when `getLineColor` is unset. */
export const DECK_MAP_DEFAULT_STROKE_COLOR: readonly [
  number,
  number,
  number,
  number,
] = DEFAULT_LAYER_STROKE_COLOR;

export function isDeckMapLayerFlatRgbaColor(
  value: unknown,
): value is [number, number, number, number?] {
  return (
    Array.isArray(value) &&
    value.length >= 3 &&
    value.length <= 4 &&
    value.every(
      (channel) => typeof channel === 'number' && Number.isFinite(channel),
    )
  );
}

/**
 * Returns the layer's flat RGBA color for an accessor, or `undefined` when the
 * accessor is a color scale / missing / not a numeric RGBA array.
 */
export function getDeckMapLayerFlatColor(
  layer: DeckMapLayerRecord | undefined,
  accessor: DeckMapLayerColorAccessor,
): [number, number, number, number] | undefined {
  const value = layer?.[accessor];
  if (!isDeckMapLayerFlatRgbaColor(value)) return undefined;
  return [value[0]!, value[1]!, value[2]!, value[3] ?? 255];
}

export function setDeckMapLayerFlatColor(
  config: DeckMapConfig,
  layerIndex: number,
  accessor: DeckMapLayerColorAccessor,
  color: readonly [number, number, number, number?],
): DeckMapConfig {
  const rgba: [number, number, number, number] = [
    color[0],
    color[1],
    color[2],
    color[3] ?? 255,
  ];
  return updateDeckMapLayer(config, layerIndex, (layer) => ({
    ...layer,
    [accessor]: rgba,
  }));
}

/** Convert a deck.gl RGBA array to a `#rrggbb` string for `<input type="color">`. */
export function deckMapRgbaToHex(
  color: readonly [number, number, number, number?],
): string {
  const toHex = (channel: number) =>
    Math.max(0, Math.min(255, Math.round(channel)))
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(color[0])}${toHex(color[1])}${toHex(color[2])}`;
}

export function clearDeckMapLayerColorScale(
  config: DeckMapConfig,
  layerIndex: number,
  accessor: DeckMapLayerColorAccessor,
): DeckMapConfig {
  const defaultColor =
    accessor === 'getLineColor'
      ? DECK_MAP_DEFAULT_STROKE_COLOR
      : DECK_MAP_DEFAULT_LAYER_COLOR;
  return updateDeckMapLayer(config, layerIndex, (layer) => ({
    ...layer,
    // Missing fill → deck.gl opaque black; keep an explicit flat color.
    [accessor]: [...defaultColor],
  }));
}

export function createDeckMapLayerColorScale(options: {
  field: string;
  type?: ColorScaleConfig['type'];
  scheme?: ColorScaleScheme;
  title?: string;
}): DeckMapLayerColorScaleFunction {
  const type = options.type ?? 'sequential';
  const scheme =
    options.scheme ??
    DECK_MAP_COLOR_SCALE_TYPE_OPTIONS.find((option) => option.value === type)
      ?.defaultScheme ??
    'Viridis';
  const base = {
    '@@function': 'colorScale' as const,
    field: options.field,
    legend: {title: options.title ?? options.field},
  };

  if (type === 'categorical') {
    return {
      ...base,
      type,
      scheme: scheme as Extract<
        ColorScaleConfig,
        {type: 'categorical'}
      >['scheme'],
    };
  }

  if (type === 'diverging') {
    return {
      ...base,
      type,
      scheme: scheme as Extract<
        ColorScaleConfig,
        {type: 'diverging'}
      >['scheme'],
      domain: 'auto',
    };
  }

  if (type === 'quantize') {
    return {
      ...base,
      type,
      scheme: scheme as Extract<ColorScaleConfig, {type: 'quantize'}>['scheme'],
      domain: 'auto',
    };
  }

  if (type === 'quantile') {
    return {
      ...base,
      type,
      scheme: scheme as Extract<ColorScaleConfig, {type: 'quantile'}>['scheme'],
    };
  }

  if (type === 'threshold') {
    return {
      ...base,
      type,
      scheme: scheme as Extract<
        ColorScaleConfig,
        {type: 'threshold'}
      >['scheme'],
      thresholds: [],
    };
  }

  return {
    ...base,
    type: 'sequential',
    scheme: scheme as Extract<ColorScaleConfig, {type: 'sequential'}>['scheme'],
    domain: 'auto',
  };
}
