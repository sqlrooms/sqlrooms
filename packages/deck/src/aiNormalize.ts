import {allKnownColorSchemeNames} from '@sqlrooms/color-scales/colorSchemeNames';
import {
  deckMapColumnLayerHasRadiusConflicts,
  stripDeckMapColumnLayerRadiusConflicts,
} from './mapLayerConfigUtils';

// Avoid importing duckdb/mosaic here — keeps Jest light.
const DECK_TABLE_DATASET_SOURCE_RELATION = '__sqlrooms_source';
function quoteDeckMapSqlIdentifier(identifier: string) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

const SCHEME_NAME_BY_LOWER = new Map(
  allKnownColorSchemeNames.map((s) => [s.toLowerCase(), s]),
);

type AiMapConfig = {
  configMode?: string;
  spec?: unknown;
  datasets?: Record<string, unknown>;
  fitToData?: unknown;
  [key: string]: unknown;
};

const DEFAULT_AI_GEOMETRY_COLUMN = '__sqlrooms_geom';
const DEFAULT_AI_POINT_RADIUS = 4;
const DEFAULT_AI_HEATMAP_RADIUS_PIXELS = 30; // deck.gl default
const DEFAULT_AI_COLUMN_RADIUS_METERS = 20;
const DEFAULT_FILL_COLOR = [56, 189, 248, 180] as const;

/** Basic-mode numeric size clamps; string accessors are validator-only. */
function normalizeAiMapConfigRadius(config: AiMapConfig): AiMapConfig {
  if (config.configMode === 'custom') return config;
  const spec = config.spec as Record<string, unknown> | undefined;
  if (!spec || !Array.isArray(spec.layers)) return config;

  let changed = false;
  const layers = spec.layers.map((layer: unknown) => {
    if (!layer || typeof layer !== 'object' || Array.isArray(layer)) {
      return layer;
    }
    let l = layer as Record<string, unknown>;
    let layerChanged = false;

    if (
      l['@@type'] === 'GeoArrowScatterplotLayer' &&
      typeof l.getRadius === 'number' &&
      l.getRadius <= 0
    ) {
      // Pair with pixel units/clamps so 4 is not meters / capped by a stale max.
      l = {
        ...l,
        getRadius: DEFAULT_AI_POINT_RADIUS,
        radiusUnits: 'pixels',
        radiusMinPixels: DEFAULT_AI_POINT_RADIUS,
        radiusMaxPixels: DEFAULT_AI_POINT_RADIUS,
      };
      layerChanged = true;
    }

    const LINE_LAYER_TYPES = new Set([
      'GeoArrowPathLayer',
      'GeoArrowArcLayer',
      'GeoArrowTripsLayer',
    ]);

    if (
      typeof l['@@type'] === 'string' &&
      LINE_LAYER_TYPES.has(l['@@type']) &&
      typeof l.getWidth === 'number'
    ) {
      if (l.widthUnits !== 'pixels') {
        l = {...l, widthUnits: 'pixels'};
        layerChanged = true;
      }
      if (
        typeof l.widthMinPixels === 'number' &&
        typeof l.widthMaxPixels === 'number' &&
        l.widthMaxPixels < l.widthMinPixels
      ) {
        const value = Math.max(
          l.widthMinPixels,
          l.widthMaxPixels,
          typeof l.getWidth === 'number' ? l.getWidth : 0,
        );
        l = {
          ...l,
          widthUnits: 'pixels',
          widthMinPixels: value,
          widthMaxPixels: value,
          getWidth: value,
        };
        layerChanged = true;
      }
    }

    if (l['@@type'] === 'GeoArrowHeatmapLayer') {
      const rp = l.radiusPixels;
      if (typeof rp === 'number' && rp <= 0) {
        l = {...l, radiusPixels: DEFAULT_AI_HEATMAP_RADIUS_PIXELS};
        layerChanged = true;
      }
    }

    // Column radius: default meters; strip scatter/heatmap radius leftovers.
    if (l['@@type'] === 'GeoArrowColumnLayer') {
      const r = l.radius;
      const needsDefaultRadius =
        typeof r !== 'string' &&
        (typeof r !== 'number' || !Number.isFinite(r) || r <= 0);
      const hasConflicts = deckMapColumnLayerHasRadiusConflicts(l);
      if (needsDefaultRadius || hasConflicts) {
        const next = stripDeckMapColumnLayerRadiusConflicts(l);
        // Stripping getRadius without setting radius leaves deck.gl's 1000m default.
        if (needsDefaultRadius) {
          next.radius = DEFAULT_AI_COLUMN_RADIUS_METERS;
        }
        l = next;
        layerChanged = true;
      }
    }

    if (layerChanged) {
      changed = true;
      return l;
    }
    return layer;
  });

  if (!changed) return config;
  return {...config, spec: {...spec, layers} as typeof spec};
}

const COLOR_ACCESSOR_PROPS = [
  'getFillColor',
  'getLineColor',
  'getColor',
  'getSourceColor',
  'getTargetColor',
] as const;

/** Safe layer defaults; invalid shapes stay for getDeckMapResourceConfigIssues. */
function normalizeAiMapConfigLayers(config: AiMapConfig): AiMapConfig {
  const spec = config.spec as Record<string, unknown> | undefined;
  if (!spec || !Array.isArray(spec.layers)) return config;

  const datasetIds = config.datasets ? Object.keys(config.datasets) : [];
  const soloDatasetId = datasetIds.length === 1 ? datasetIds[0] : undefined;

  let changed = false;
  const layers = spec.layers.map((layer: unknown) => {
    if (!layer || typeof layer !== 'object' || Array.isArray(layer)) {
      return layer;
    }
    let l = layer as Record<string, unknown>;
    let layerChanged = false;

    // scaleLinear → scale only for getElevation (radius/width scales are invalid).
    {
      const value = l.getElevation;
      if (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        (value as Record<string, unknown>)['@@function'] === 'scaleLinear'
      ) {
        l = {
          ...l,
          getElevation: {...(value as object), '@@function': 'scale'},
        };
        layerChanged = true;
      }
    }

    // Canonicalize scheme casing / trim; type×scheme mismatches stay for validation.
    for (const prop of COLOR_ACCESSOR_PROPS) {
      const value = l[prop];
      if (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        '@@function' in (value as Record<string, unknown>) &&
        (value as Record<string, unknown>)['@@function'] === 'colorScale'
      ) {
        const v = value as Record<string, unknown>;
        let next = v;
        const rawScheme = v.scheme;
        if (typeof rawScheme === 'string') {
          const trimmed = rawScheme.trim();
          const canonical =
            SCHEME_NAME_BY_LOWER.get(trimmed.toLowerCase()) ?? trimmed;
          if (canonical !== rawScheme) {
            next = {...next, scheme: canonical};
          }
        }
        if (typeof v.type === 'string' && v.type !== v.type.trim()) {
          next = {...next, type: v.type.trim()};
        }
        if (next !== v) {
          l = {...l, [prop]: next};
          layerChanged = true;
        }
      }
    }

    // Solo dataset: inject missing binding or replace unknown dataset ids.
    if (soloDatasetId) {
      const binding = l._sqlroomsBinding as Record<string, unknown> | undefined;
      const boundId =
        binding && typeof binding.dataset === 'string' && binding.dataset.trim()
          ? binding.dataset.trim()
          : undefined;
      const needsBinding =
        !boundId ||
        !(config.datasets && boundId in (config.datasets as object));
      if (needsBinding) {
        l = {
          ...l,
          _sqlroomsBinding: {...(binding ?? {}), dataset: soloDatasetId},
        };
        layerChanged = true;
      }
    }

    // AI-only strip: UI may keep colorRange; do not reject in the resource validator.
    if (l['@@type'] === 'GeoArrowHeatmapLayer' && 'colorRange' in l) {
      const {colorRange: _cr, ...rest} = l;
      l = rest;
      layerChanged = true;
    }

    // Lift simple @@=column into hexagonColumn for fit-to-bounds.
    if (l['@@type'] === 'GeoArrowH3HexagonLayer') {
      const hexAccessor = l.getHexagon;
      let hexColumn: string | undefined;
      if (typeof hexAccessor === 'string') {
        const m = hexAccessor.trim().match(/^@@=([A-Za-z_][\w]*)$/);
        hexColumn = m?.[1];
      }
      const binding =
        l._sqlroomsBinding &&
        typeof l._sqlroomsBinding === 'object' &&
        !Array.isArray(l._sqlroomsBinding)
          ? (l._sqlroomsBinding as Record<string, unknown>)
          : undefined;
      if (
        hexColumn &&
        (!binding?.hexagonColumn ||
          typeof binding.hexagonColumn !== 'string' ||
          !(binding.hexagonColumn as string).trim())
      ) {
        l = {
          ...l,
          _sqlroomsBinding: {
            ...(binding ?? {}),
            hexagonColumn: hexColumn,
          },
        };
        layerChanged = true;
      }
    }

    if (
      l['@@type'] === 'GeoArrowColumnLayer' &&
      l.getElevation !== undefined &&
      l.extruded === undefined
    ) {
      l = {...l, extruded: true};
      layerChanged = true;
    }

    // deck.gl defaults missing fill to opaque black.
    const layerType = l['@@type'];
    const needsFillDefault =
      typeof layerType === 'string' &&
      (layerType === 'GeoArrowScatterplotLayer' ||
        layerType === 'GeoArrowPolygonLayer' ||
        layerType === 'GeoArrowSolidPolygonLayer') &&
      !l.getFillColor;
    if (needsFillDefault) {
      l = {...l, getFillColor: [...DEFAULT_FILL_COLOR]};
      layerChanged = true;
    }

    // filled:false with no stroke renders nothing.
    if (
      l['@@type'] === 'GeoArrowScatterplotLayer' &&
      l.filled === false &&
      !l.stroked
    ) {
      l = {...l, filled: true};
      layerChanged = true;
    }

    if (layerChanged) changed = true;
    return layerChanged ? l : layer;
  });

  // Keep visible:false — legitimate hide state (type switches use replaceLayers).

  if (!changed) return config;
  return {...config, spec: {...spec, layers} as typeof spec};
}

/** Split table refs on dots outside double quotes. */
function splitTableRef(ref: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const ch of ref) {
    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
    } else if (ch === '.' && !inQuotes) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts;
}

function unquoteTableRefPart(part: string): string {
  const trimmed = part.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/""/g, '"');
  }
  return trimmed;
}

function normalizeAiMapConfigDatasetSources(
  config: AiMapConfig,
  stripCatalogNames: ReadonlySet<string>,
): AiMapConfig {
  const datasets = config.datasets;
  if (!datasets || typeof datasets !== 'object') return config;

  // Arc-bound geom columns that need WKB decode hints.
  const arcGeomColsByDataset = new Map<string, Set<string>>();
  const spec = config.spec as Record<string, unknown> | undefined;
  if (spec && Array.isArray(spec.layers)) {
    for (const layer of spec.layers) {
      if (!layer || typeof layer !== 'object') continue;
      const l = layer as Record<string, unknown>;
      if (l['@@type'] !== 'GeoArrowArcLayer') continue;
      const binding = l._sqlroomsBinding as Record<string, unknown> | undefined;
      const datasetId =
        typeof binding?.dataset === 'string' ? binding.dataset : undefined;
      if (!datasetId) continue;
      const cols = arcGeomColsByDataset.get(datasetId) ?? new Set<string>();
      if (typeof binding?.sourceGeometryColumn === 'string') {
        cols.add(binding.sourceGeometryColumn);
      }
      if (typeof binding?.targetGeometryColumn === 'string') {
        cols.add(binding.targetGeometryColumn);
      }
      if (cols.size > 0) arcGeomColsByDataset.set(datasetId, cols);
    }
  }

  let changed = false;
  const nextDatasets: Record<string, unknown> = {};

  for (const [id, dataset] of Object.entries(datasets)) {
    const d = dataset as Record<string, unknown> | undefined;
    const source = d?.source as Record<string, unknown> | undefined;
    const tableName = source?.tableName;

    let next = d;
    let nextSource = source;

    if (typeof tableName === 'string' && stripCatalogNames.size > 0) {
      const parts = splitTableRef(tableName);
      if (parts.length >= 3) {
        const catalog = unquoteTableRefPart(parts[0]!).toLowerCase();
        if (stripCatalogNames.has(catalog)) {
          const stripped = parts.slice(1).join('.');
          nextSource = {...nextSource, tableName: stripped};
          next = {...next, source: nextSource};
          changed = true;
        }
      }
    }

    // Scope WKB hints to this dataset's arc columns only.
    const transformSql = (next?.source as Record<string, unknown> | undefined)
      ?.transformSql as string | undefined;
    const arcCols = arcGeomColsByDataset.get(id);

    if (
      arcCols &&
      arcCols.size > 0 &&
      typeof transformSql === 'string' &&
      !next?.geometryEncodingHint
    ) {
      const mentionsArcCol = [...arcCols].some((col) =>
        transformSql.includes(col),
      );
      if (mentionsArcCol) {
        next = {...next, geometryEncodingHint: 'wkb'};
        changed = true;
      }
    }

    nextDatasets[id] = next ?? dataset;
  }

  if (!changed) return config;
  return {...config, datasets: nextDatasets as typeof config.datasets};
}

/** Inject lon/lat → `__sqlrooms_geom` transform when fitToData needs it. */
function normalizeAiMapConfig(config: AiMapConfig): AiMapConfig {
  // mapbox:// mapStyle: leave for validator (do not strip silently).

  const datasets = config.datasets;
  let fitToData = config.fitToData as
    | Record<string, unknown>
    | null
    | undefined;

  // Unwrap { datasetId: { dataset, … } } → flat fitToData.
  if (fitToData && !fitToData.dataset && typeof fitToData === 'object') {
    const keys = Object.keys(fitToData);
    if (keys.length === 1) {
      const nested = fitToData[keys[0]!] as Record<string, unknown> | undefined;
      if (nested && typeof nested === 'object' && nested.dataset) {
        fitToData = nested;
        config = {...config, fitToData: fitToData as any};
      }
    }
  }

  // Default fitToData to sole dataset / first layer binding.
  if (!fitToData?.dataset && datasets && typeof datasets === 'object') {
    const datasetIds = Object.keys(datasets);
    let datasetId: string | undefined =
      datasetIds.length === 1 ? datasetIds[0] : undefined;

    if (!datasetId) {
      const spec = config.spec as Record<string, unknown> | undefined;
      const layers = Array.isArray(spec?.layers) ? spec.layers : [];
      for (const layer of layers) {
        if (!layer || typeof layer !== 'object') continue;
        const binding = (layer as Record<string, unknown>)._sqlroomsBinding as
          | Record<string, unknown>
          | undefined;
        if (typeof binding?.dataset === 'string' && binding.dataset.trim()) {
          datasetId = binding.dataset;
          break;
        }
      }
    }

    if (datasetId && datasets[datasetId]) {
      fitToData = {dataset: datasetId};
      config = {...config, fitToData: fitToData as any};
    }
  }

  if (!datasets || typeof datasets !== 'object' || !fitToData) {
    return config;
  }

  const lonCol = fitToData.longitudeColumn as string | undefined;
  const latCol = fitToData.latitudeColumn as string | undefined;
  if (!lonCol || !latCol) {
    return config;
  }

  const targetDatasetId = fitToData.dataset as string | undefined;
  if (!targetDatasetId) {
    return config;
  }

  const targetDataset = datasets[targetDatasetId] as
    | Record<string, unknown>
    | undefined;
  if (!targetDataset) {
    return config;
  }

  const source = targetDataset.source as
    | {tableName?: string; transformSql?: string; sqlQuery?: string}
    | undefined;

  // Inject ST_Point WKB as `__sqlrooms_geom` for point layers only (never AS geom).
  if (!source?.tableName || source.sqlQuery || source.transformSql) {
    return config;
  }

  const POINT_LONLAT_LAYER_TYPES = new Set([
    'GeoArrowScatterplotLayer',
    'GeoArrowHeatmapLayer',
    'GeoArrowColumnLayer',
    'GeoJsonLayer',
    // Unprefixed aliases may appear before validator repair.
    'ScatterplotLayer',
    'HeatmapLayer',
    'ColumnLayer',
  ]);
  const datasetIds = Object.keys(datasets);
  const soleDatasetId = datasetIds.length === 1 ? datasetIds[0] : undefined;
  const layerTargetsDataset = (
    binding: Record<string, unknown> | undefined,
  ): boolean => {
    if (binding?.dataset === targetDatasetId) return true;
    // Match solo-dataset binding injection in normalizeAiMapConfigLayers.
    return (
      (!binding || typeof binding.dataset !== 'string' || !binding.dataset) &&
      soleDatasetId === targetDatasetId
    );
  };
  const spec = config.spec as Record<string, unknown> | undefined;
  const layers = Array.isArray(spec?.layers) ? spec.layers : [];
  const pointLayersForDataset = layers.filter((layer) => {
    if (!layer || typeof layer !== 'object') return false;
    const rec = layer as Record<string, unknown>;
    if (rec.visible === false) return false;
    if (
      typeof rec['@@type'] !== 'string' ||
      !POINT_LONLAT_LAYER_TYPES.has(rec['@@type'])
    ) {
      return false;
    }
    const binding = rec._sqlroomsBinding as Record<string, unknown> | undefined;
    return layerTargetsDataset(binding);
  });
  if (pointLayersForDataset.length === 0) {
    return config;
  }

  const geometryColumn = DEFAULT_AI_GEOMETRY_COLUMN;
  const quotedLon = quoteDeckMapSqlIdentifier(lonCol);
  const quotedLat = quoteDeckMapSqlIdentifier(latCol);
  const quotedGeom = quoteDeckMapSqlIdentifier(geometryColumn);
  const transformSql = [
    `SELECT *, ST_AsWKB(ST_Point(${quotedLon}, ${quotedLat})) AS ${quotedGeom}`,
    `FROM ${DECK_TABLE_DATASET_SOURCE_RELATION}`,
    `WHERE ${quotedLon} IS NOT NULL AND ${quotedLat} IS NOT NULL`,
  ].join(' ');

  const nextLayers = layers.map((layer) => {
    if (!layer || typeof layer !== 'object') return layer;
    const rec = layer as Record<string, unknown>;
    if (
      typeof rec['@@type'] !== 'string' ||
      !POINT_LONLAT_LAYER_TYPES.has(rec['@@type'])
    ) {
      return layer;
    }
    const binding = rec._sqlroomsBinding as Record<string, unknown> | undefined;
    if (!layerTargetsDataset(binding)) return layer;
    const nextBinding = {
      ...(binding ?? {}),
      dataset: (binding?.dataset as string | undefined) ?? targetDatasetId,
      geometryColumn,
    };
    if (
      binding?.dataset === nextBinding.dataset &&
      binding?.geometryColumn === geometryColumn
    ) {
      return layer;
    }
    return {
      ...rec,
      _sqlroomsBinding: nextBinding,
    };
  });
  const layersChanged = nextLayers.some((layer, i) => layer !== layers[i]);

  return {
    ...config,
    ...(layersChanged && spec
      ? {spec: {...spec, layers: nextLayers} as typeof config.spec}
      : {}),
    datasets: {
      ...datasets,
      [targetDatasetId]: {
        ...targetDataset,
        source: {tableName: source.tableName, transformSql},
        geometryColumn,
        geometryEncodingHint: 'wkb',
      },
    },
  };
}

/**
 * Idempotent AI map-config repairs (scheme casing, sizes, bindings, fit inject).
 * Invalid shapes stay for {@link getDeckMapResourceConfigIssues} / agent retry.
 */
export type NormalizeAiDeckMapConfigOptions = {
  /** Host-injected catalogs to strip; omit for none — deck does not hardcode any. */
  stripCatalogNames?: readonly string[];
};

export function normalizeAiDeckMapConfig<T extends Record<string, unknown>>(
  config: T,
  options?: NormalizeAiDeckMapConfigOptions,
): T {
  const stripCatalogNames = new Set(
    (options?.stripCatalogNames ?? [])
      .map((name) => name.trim().toLowerCase())
      .filter((name) => name.length > 0),
  );
  return normalizeAiMapConfigRadius(
    normalizeAiMapConfigLayers(
      normalizeAiMapConfigDatasetSources(
        normalizeAiMapConfig(config as unknown as AiMapConfig),
        stripCatalogNames,
      ),
    ),
  ) as unknown as T;
}

const COLOR_SCALE_ACCESSOR_PROPS = [
  'getFillColor',
  'getLineColor',
  'getColor',
  'getSourceColor',
  'getTargetColor',
] as const;

export type ResolveColorScaleTable = (
  tableName: string,
) => {columns?: {name: string}[]} | undefined;

/**
 * Fix colorScale `field` casing; reject unknown fields on bare `{tableName}` sources.
 * Call before normalize so lon/lat `transformSql` inject does not disable rejection.
 */
export function validateAndFixColorScaleFields<
  T extends {spec?: unknown; datasets?: Record<string, unknown>},
>(config: T, resolveTable: ResolveColorScaleTable): T {
  const rawSpec = config.spec;
  if (!rawSpec) return config;
  let spec: Record<string, unknown>;
  if (typeof rawSpec === 'string') {
    try {
      const parsed = JSON.parse(rawSpec) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return config;
      }
      spec = parsed as Record<string, unknown>;
    } catch {
      return config;
    }
  } else if (typeof rawSpec === 'object' && !Array.isArray(rawSpec)) {
    spec = rawSpec as Record<string, unknown>;
  } else {
    return config;
  }
  const layers = Array.isArray(spec.layers)
    ? (spec.layers as Record<string, unknown>[])
    : [];

  const columnsByDataset = new Map<
    string,
    {
      byLower: Map<string, string>;
      rejectUnknown: boolean;
      derivedSql: string;
    }
  >();
  for (const [datasetId, dataset] of Object.entries(config.datasets ?? {})) {
    const source = (dataset as Record<string, unknown>)?.source as
      | Record<string, unknown>
      | undefined;
    if (!source) continue;
    const tableName =
      typeof source.tableName === 'string' ? source.tableName : undefined;
    if (!tableName) continue;

    const table = resolveTable(tableName);
    if (!table?.columns?.length) continue;

    const transformSql =
      typeof source.transformSql === 'string' ? source.transformSql : '';
    const sqlQuery = typeof source.sqlQuery === 'string' ? source.sqlQuery : '';
    const derivedSql = `${transformSql} ${sqlQuery}`.trim();
    const hasDerivedSql = derivedSql.length > 0;

    const byLower = new Map<string, string>();
    for (const col of table.columns) {
      byLower.set(col.name.toLowerCase(), col.name);
    }
    columnsByDataset.set(datasetId, {
      byLower,
      rejectUnknown: !hasDerivedSql,
      derivedSql,
    });
  }

  if (columnsByDataset.size === 0) return config;

  const datasetIds = Object.keys(config.datasets ?? {});
  const soloDatasetId = datasetIds.length === 1 ? datasetIds[0] : undefined;

  const errors: string[] = [];
  let changed = false;
  const nextLayers = layers.map((layer, i) => {
    const binding = layer._sqlroomsBinding as
      | Record<string, unknown>
      | undefined;
    const boundDataset =
      typeof binding?.dataset === 'string' && binding.dataset.trim()
        ? binding.dataset
        : undefined;
    // Mirror solo-dataset binding repair in normalize.
    const datasetId =
      boundDataset && columnsByDataset.has(boundDataset)
        ? boundDataset
        : (soloDatasetId ?? boundDataset);
    const cols = datasetId ? columnsByDataset.get(datasetId) : undefined;
    if (!cols || !datasetId) return layer;

    let nextLayer: Record<string, unknown> | undefined;
    for (const prop of COLOR_SCALE_ACCESSOR_PROPS) {
      const accessor = (nextLayer ?? layer)[prop];
      if (!accessor || typeof accessor !== 'object' || Array.isArray(accessor))
        continue;
      const acc = accessor as Record<string, unknown>;
      if (acc['@@function'] !== 'colorScale') continue;
      const field = acc.field;
      if (typeof field !== 'string') continue;

      const canonical = cols.byLower.get(field.toLowerCase());
      if (canonical === field) {
        continue;
      }
      if (canonical !== undefined) {
        nextLayer = {
          ...(nextLayer ?? layer),
          [prop]: {...acc, field: canonical},
        };
        changed = true;
        continue;
      }
      if (!cols.rejectUnknown) {
        // Allow SQL aliases; reject typos absent from both schema and SQL text.
        if (cols.derivedSql.toLowerCase().includes(field.toLowerCase())) {
          continue;
        }
      }
      const available = [...cols.byLower.values()].join(', ');
      errors.push(
        `spec.layers.${i}.${prop}: colorScale field "${field}" is not a column in dataset "${datasetId}". Available columns: ${available}`,
      );
    }
    return nextLayer ?? layer;
  });

  if (errors.length > 0) {
    throw new Error(errors.join('; '));
  }

  if (!changed && typeof rawSpec !== 'string') return config;
  return {
    ...config,
    spec: {
      ...spec,
      layers: nextLayers,
    },
  } as T;
}

/**
 * Validate colorScale fields (optional), then {@link normalizeAiDeckMapConfig}.
 * Validation first so lon/lat transformSql inject does not disable unknown-field checks.
 */
export type PrepareAiDeckMapConfigOptions = NormalizeAiDeckMapConfigOptions & {
  resolveTable?: ResolveColorScaleTable;
};

export function prepareAiDeckMapConfig<T extends Record<string, unknown>>(
  config: T,
  options?: PrepareAiDeckMapConfigOptions,
): T {
  const withFields = options?.resolveTable
    ? validateAndFixColorScaleFields(config, options.resolveTable)
    : config;
  return normalizeAiDeckMapConfig(withFields, {
    stripCatalogNames: options?.stripCatalogNames,
  });
}
