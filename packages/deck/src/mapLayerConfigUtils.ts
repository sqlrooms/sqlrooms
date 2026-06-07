import type {ColorScaleConfig, ColorScaleScheme} from '@sqlrooms/color-scales';
import type {DeckMapDashboardPanelConfig} from './dashboardConfig';
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
  value: DeckAutoLayerType | 'GeoArrowSolidPolygonLayer';
  label: string;
}> = [
  {value: 'GeoArrowScatterplotLayer', label: 'Scatterplot'},
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
  'geojsonlayer',
  'polygonlayer',
  'solidpolygonlayer',
  'geojson',
  'polygon',
  'solid polygon',
]);

const H3_LAYER_TYPES = new Set(['geoarrowh3hexagonlayer', 'h3hexagonlayer']);

const ARC_LAYER_TYPES = new Set(['geoarrowarclayer', 'arclayer']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function getObjectSpec(
  config: DeckMapDashboardPanelConfig,
): Record<string, unknown> | undefined {
  return isRecord(config.spec) ? config.spec : undefined;
}

export function getDeckMapLayerRecords(
  config: DeckMapDashboardPanelConfig,
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

  return DECK_MAP_COLOR_ACCESSOR_OPTIONS.filter(
    (option) =>
      option.value === 'getFillColor' || option.value === 'getLineColor',
  );
}

export function updateDeckMapLayer(
  config: DeckMapDashboardPanelConfig,
  layerIndex: number,
  updater: (layer: DeckMapLayerRecord) => DeckMapLayerRecord,
): DeckMapDashboardPanelConfig {
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
  config: DeckMapDashboardPanelConfig,
  layerIndex: number,
  layerType: string,
): DeckMapDashboardPanelConfig {
  return updateDeckMapLayer(config, layerIndex, (layer) => ({
    ...layer,
    '@@type': layerType,
  }));
}

export function setDeckMapLayerGeometryColumn(
  config: DeckMapDashboardPanelConfig,
  layerIndex: number,
  geometryColumn: string,
): DeckMapDashboardPanelConfig {
  const layer = getDeckMapLayerRecords(config)[layerIndex];
  const datasetId = getDeckMapLayerDatasetId(layer);
  if (!datasetId || !config.datasets?.[datasetId]) {
    return config;
  }

  return {
    ...config,
    datasets: {
      ...config.datasets,
      [datasetId]: {
        ...config.datasets[datasetId],
        geometryColumn,
      },
    },
  };
}

export function setDeckMapLayerHexagonColumn(
  config: DeckMapDashboardPanelConfig,
  layerIndex: number,
  hexagonColumn: string,
): DeckMapDashboardPanelConfig {
  return updateDeckMapLayer(config, layerIndex, (layer) => ({
    ...layer,
    _sqlroomsBinding: {
      ...(isRecord(layer._sqlroomsBinding) ? layer._sqlroomsBinding : {}),
      hexagonColumn,
    },
  }));
}

export function setDeckMapLayerArcColumns(
  config: DeckMapDashboardPanelConfig,
  layerIndex: number,
  columns: {
    sourceGeometryColumn?: string;
    targetGeometryColumn?: string;
    sourceLatitudeColumn?: string;
    sourceLongitudeColumn?: string;
    targetLatitudeColumn?: string;
    targetLongitudeColumn?: string;
  },
): DeckMapDashboardPanelConfig {
  return updateDeckMapLayer(config, layerIndex, (layer) => ({
    ...layer,
    _sqlroomsBinding: {
      ...(isRecord(layer._sqlroomsBinding) ? layer._sqlroomsBinding : {}),
      ...columns,
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
  config: DeckMapDashboardPanelConfig,
  layerIndex: number,
  accessor: DeckMapLayerColorAccessor,
  colorScale: DeckMapLayerColorScaleFunction,
): DeckMapDashboardPanelConfig {
  return updateDeckMapLayer(config, layerIndex, (layer) => ({
    ...layer,
    [accessor]: colorScale,
  }));
}

export function clearDeckMapLayerColorScale(
  config: DeckMapDashboardPanelConfig,
  layerIndex: number,
  accessor: DeckMapLayerColorAccessor,
): DeckMapDashboardPanelConfig {
  return updateDeckMapLayer(config, layerIndex, (layer) => {
    const nextLayer = {...layer};
    delete nextLayer[accessor];
    return nextLayer;
  });
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
