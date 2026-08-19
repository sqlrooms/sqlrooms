import type {ColorScaleConfig, ColorScaleScheme} from '@sqlrooms/color-scales';
import type {DeckMapConfig} from './mapConfig';
import type {DeckAutoLayerType} from './types';
import {isColorScaleFunction} from './json/layerConfig';

export type DeckMapLayerRecord = Record<string, unknown>;

export type DeckMapLayerColorScaleFunction = ColorScaleConfig & {
  '@@function': 'colorScale';
  /**
   * Per-accessor opacity (0–1). Preferred over layer-level `opacity` so fill and
   * stroke (or arc endpoints) can be dimmed independently.
   */
  opacity?: number;
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

const EXTRUDABLE_LAYER_TYPES = new Set([
  'geoarrowh3hexagonlayer',
  'h3hexagonlayer',
  'geoarrowcolumnlayer',
  'columnlayer',
  'geoarrowpolygonlayer',
  'polygonlayer',
  'geoarrowsolidpolygonlayer',
  'solidpolygonlayer',
  'geojsonlayer',
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
  // SolidPolygon: no stroked outlines (wireframe only).
  'geojsonlayer',
]);

export function usesStrokeSetting(layerType: unknown) {
  return (
    typeof layerType === 'string' &&
    STROKE_LAYER_TYPES.has(layerType.toLowerCase())
  );
}

/** Polygon, GeoJSON, and H3 do not draw strokes while extruded. */
export function usesStrokeExtrusionWarning(layerType: unknown) {
  if (typeof layerType !== 'string') return false;
  const type = layerType.toLowerCase();
  return (
    type === 'geojsonlayer' ||
    type === 'geoarrowpolygonlayer' ||
    type === 'polygonlayer' ||
    H3_LAYER_TYPES.has(type)
  );
}

/** True for GeoArrow / deck H3 hexagon layer class names. */
export function isDeckMapH3HexagonLayer(layerType: unknown): boolean {
  return (
    typeof layerType === 'string' && H3_LAYER_TYPES.has(layerType.toLowerCase())
  );
}

/** Effective `extruded`; H3 and Column default to true when omitted. */
export function getDeckMapLayerExtruded(
  layer: DeckMapLayerRecord | undefined,
): boolean {
  if (typeof layer?.extruded === 'boolean') return layer.extruded;
  const layerType = layer?.['@@type'];
  return (
    isDeckMapH3HexagonLayer(layerType) || usesColumnRadiusSetting(layerType)
  );
}

/** Default `stroked` when omitted. H3 strokes only when not extruded. */
export function getDeckMapLayerStrokeDefault(
  layerType: unknown,
  options?: {extruded?: boolean},
): boolean {
  if (typeof layerType !== 'string') return false;
  const type = layerType.toLowerCase();
  if (
    type.includes('scatterplot') ||
    type.includes('solidpolygon') ||
    type === 'solid polygon'
  ) {
    return false;
  }
  if (isDeckMapH3HexagonLayer(layerType)) {
    const extruded = options?.extruded ?? true;
    return !extruded;
  }
  return true;
}

function deckMapLayerHasActiveStroke(layer: DeckMapLayerRecord): boolean {
  if (typeof layer.stroked === 'boolean') return layer.stroked;
  return getDeckMapLayerStrokeDefault(layer['@@type'], {
    extruded: getDeckMapLayerExtruded(layer),
  });
}

/** Bake `layer.opacity` into flat alphas / colorScale.opacity, then drop it. */
export function detachDeckMapLayerOpacity(
  layer: DeckMapLayerRecord,
): DeckMapLayerRecord {
  const opacity = layer.opacity;
  if (typeof opacity !== 'number' || !Number.isFinite(opacity)) {
    return layer;
  }
  const factor = Math.max(0, Math.min(1, opacity));
  const next: DeckMapLayerRecord = {...layer};
  const accessors = getDeckMapColorAccessorOptions(next['@@type']);
  // Implicit Deck defaults are still dimmed by layer.opacity — materialize
  // them so dropping opacity does not leave a sibling channel fully opaque.
  const implicitColor: [number, number, number, number] = [0, 0, 0, 255];
  if (
    accessors.some((option) => option.value === 'getFillColor') &&
    next.getFillColor === undefined &&
    next.filled !== false
  ) {
    next.getFillColor = [...implicitColor];
  }
  if (
    accessors.some((option) => option.value === 'getLineColor') &&
    next.getLineColor === undefined &&
    deckMapLayerHasActiveStroke(next)
  ) {
    next.getLineColor = [...implicitColor];
  }
  for (const {value} of DECK_MAP_COLOR_ACCESSOR_OPTIONS) {
    const color = next[value];
    if (isDeckMapLayerFlatRgbaColor(color)) {
      const channelAlpha = color[3] ?? 255;
      next[value] = [
        color[0]!,
        color[1]!,
        color[2]!,
        Math.round(Math.max(0, Math.min(255, channelAlpha * factor))),
      ];
      continue;
    }
    const scale = getDeckMapLayerColorScale(next, value);
    if (scale) {
      next[value] = {
        ...scale,
        opacity: getDeckMapColorScaleOpacity(scale) * factor,
      };
    }
  }
  const {opacity: _droppedOpacity, ...rest} = next;
  void _droppedOpacity;
  return rest;
}

/** Opacity 0–1 on a color-scale accessor (default 1). */
export function getDeckMapColorScaleOpacity(
  colorScale: DeckMapLayerColorScaleFunction | undefined,
): number {
  const opacity = colorScale?.opacity;
  if (typeof opacity === 'number' && Number.isFinite(opacity)) {
    return Math.max(0, Math.min(1, opacity));
  }
  return 1;
}

/** Layer-level opacity factor 0–1 (1 when omitted). */
export function getDeckMapLayerOpacityFactor(
  layer: DeckMapLayerRecord | undefined,
): number {
  const opacity = layer?.opacity;
  if (typeof opacity === 'number' && Number.isFinite(opacity)) {
    return Math.max(0, Math.min(1, opacity));
  }
  return 1;
}

/**
 * Effective 0–100 opacity for a color accessor, including legacy `layer.opacity`.
 * Matches the value the Appearance slider should show before detaching.
 */
export function getDeckMapLayerChannelOpacityPercent(
  layer: DeckMapLayerRecord | undefined,
  accessor: DeckMapLayerColorAccessor,
  fallbackFlatAlpha = 255,
): number {
  const factor = getDeckMapLayerOpacityFactor(layer);
  const scale = getDeckMapLayerColorScale(layer, accessor);
  if (scale) {
    return Math.round(getDeckMapColorScaleOpacity(scale) * factor * 100);
  }
  const flat = getDeckMapLayerFlatColor(layer, accessor);
  const alpha = flat?.[3] ?? fallbackFlatAlpha;
  return Math.round((Math.max(0, Math.min(255, alpha * factor)) / 255) * 100);
}

function flatColorWithScaleOpacity(
  color: readonly [number, number, number, number],
  scale: DeckMapLayerColorScaleFunction | undefined,
): [number, number, number, number] {
  const opacity = getDeckMapColorScaleOpacity(scale);
  const hasExplicitOpacity =
    typeof scale?.opacity === 'number' && Number.isFinite(scale.opacity);
  const alpha = hasExplicitOpacity
    ? Math.round(Math.max(0, Math.min(255, opacity * 255)))
    : (color[3] ?? 255);
  return [color[0], color[1], color[2], alpha];
}

/** Replace a color scale with flat RGBA (bakes scale opacity into alpha). */
export function replaceDeckMapLayerColorScaleWithFlat(
  layer: DeckMapLayerRecord,
  accessor: DeckMapLayerColorAccessor,
  flatColor: readonly [number, number, number, number],
): DeckMapLayerRecord {
  const scale = getDeckMapLayerColorScale(layer, accessor);
  return detachDeckMapLayerOpacity({
    ...layer,
    [accessor]: flatColorWithScaleOpacity(flatColor, scale),
  });
}

/** Replace multiple color scales with flat RGBA (e.g. arc source+target). */
export function replaceDeckMapLayerColorScalesWithFlat(
  layer: DeckMapLayerRecord,
  replacements: Partial<
    Record<DeckMapLayerColorAccessor, readonly [number, number, number, number]>
  >,
): DeckMapLayerRecord {
  const next: DeckMapLayerRecord = {...layer};
  for (const accessor of Object.keys(
    replacements,
  ) as DeckMapLayerColorAccessor[]) {
    const color = replacements[accessor];
    if (!color) continue;
    const scale = getDeckMapLayerColorScale(layer, accessor);
    next[accessor] = flatColorWithScaleOpacity(color, scale);
  }
  return detachDeckMapLayerOpacity(next);
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

/** Default flat fill RGBA. */
export const DECK_MAP_DEFAULT_LAYER_COLOR: readonly [
  number,
  number,
  number,
  number,
] = DEFAULT_LAYER_FILL_COLOR;

/** Default stroke RGBA. */
export const DECK_MAP_DEFAULT_STROKE_COLOR: readonly [
  number,
  number,
  number,
  number,
] = DEFAULT_LAYER_STROKE_COLOR;

/** True when `value` is a 3- or 4-channel numeric RGB(A) array. */
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

/** Flat RGBA for an accessor, or undefined if scaled/missing. */
export function getDeckMapLayerFlatColor(
  layer: DeckMapLayerRecord | undefined,
  accessor: DeckMapLayerColorAccessor,
): [number, number, number, number] | undefined {
  const value = layer?.[accessor];
  if (!isDeckMapLayerFlatRgbaColor(value)) return undefined;
  return [value[0]!, value[1]!, value[2]!, value[3] ?? 255];
}

/** Set a color accessor to a constant RGB(A); alpha defaults to 255. */
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

/** RGBA → `#rrggbb` for `<input type="color">`. */
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
  return updateDeckMapLayer(config, layerIndex, (layer) =>
    replaceDeckMapLayerColorScaleWithFlat(layer, accessor, defaultColor),
  );
}

export function createDeckMapLayerColorScale(options: {
  field: string;
  type?: ColorScaleConfig['type'];
  scheme?: ColorScaleScheme;
  title?: string;
  /** Per-accessor opacity 0–1. */
  opacity?: number;
}): DeckMapLayerColorScaleFunction {
  const type = options.type ?? 'sequential';
  const scheme =
    options.scheme ??
    DECK_MAP_COLOR_SCALE_TYPE_OPTIONS.find((option) => option.value === type)
      ?.defaultScheme ??
    'Viridis';
  const opacity =
    typeof options.opacity === 'number' && Number.isFinite(options.opacity)
      ? Math.max(0, Math.min(1, options.opacity))
      : undefined;
  const base = {
    '@@function': 'colorScale' as const,
    field: options.field,
    legend: {title: options.title ?? options.field},
    ...(opacity !== undefined ? {opacity} : {}),
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
