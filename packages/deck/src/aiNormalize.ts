import {allKnownColorSchemeNames} from '@sqlrooms/color-scales/colorSchemeNames';
import {
  deckMapColumnLayerHasRadiusConflicts,
  stripDeckMapColumnLayerRadiusConflicts,
} from './mapLayerConfigUtils';

// Inlined SQL helpers keep this module free of heavy workspace-package imports
// (e.g. @sqlrooms/duckdb, @sqlrooms/mosaic) that would break Jest.
const DECK_TABLE_DATASET_SOURCE_RELATION = '__sqlrooms_source';
function quoteDeckMapSqlIdentifier(identifier: string) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

/** Lower-cased name → canonical casing, e.g. "blues" → "Blues". */
const SCHEME_NAME_BY_LOWER = new Map(
  allKnownColorSchemeNames.map((s) => [s.toLowerCase(), s]),
);

// Minimal structural type that covers both AiMapConfig
// and DeckMapConfig — all the passes only access these loose fields.
type AiMapConfig = {
  configMode?: string;
  spec?: unknown;
  datasets?: Record<string, unknown>;
  fitToData?: unknown;
  [key: string]: unknown;
};

const DEFAULT_AI_GEOMETRY_COLUMN = '__sqlrooms_geom';
const DEFAULT_AI_POINT_RADIUS = 4;
const DEFAULT_AI_HEATMAP_RADIUS_PIXELS = 30; // matches deck.gl default
const DEFAULT_AI_COLUMN_RADIUS_METERS = 20; // city-scale default
/** Sky-blue default fill — matches the UI builder's DEFAULT_FILL_COLOR. */
const DEFAULT_FILL_COLOR = [56, 189, 248, 180] as const;

/**
 * Basic-mode numeric repairs for radius/width/elevation props.
 * String expression accessors are rejected by getDeckMapResourceConfigIssues
 * (agent retry) — only zero/negative clamps and structural defaults live here.
 */
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
      // Pair the default radius with pixel units / clamps so deck.gl does not
      // interpret 4 as meters or keep a stale radiusMaxPixels cap.
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

    // Apply widthUnits and inverted-clamp repairs in one pass so a missing
    // widthUnits does not skip the max < min fix below.
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

    // Clamp heatmap radiusPixels: zero/negative values produce an invisible
    // heatmap. String expressions are rejected by the validator.
    if (l['@@type'] === 'GeoArrowHeatmapLayer') {
      const rp = l.radiusPixels;
      if (typeof rp === 'number' && rp <= 0) {
        l = {...l, radiusPixels: DEFAULT_AI_HEATMAP_RADIUS_PIXELS};
        layerChanged = true;
      }
    }

    // Clamp column radius (meters): missing/zero/negative values produce
    // invisible columns. String radius is rejected by the validator. Also
    // strip point/heatmap radius leftovers — radiusUnits:"pixels" makes
    // radius N mean N pixels (city-scale disks).
    if (l['@@type'] === 'GeoArrowColumnLayer') {
      const r = l.radius;
      // Leave string radius for the validator; still repair other cases.
      const needsDefaultRadius =
        typeof r !== 'string' &&
        (typeof r !== 'number' || !Number.isFinite(r) || r <= 0);
      const hasConflicts = deckMapColumnLayerHasRadiusConflicts(l);
      if (needsDefaultRadius || hasConflicts) {
        const next = stripDeckMapColumnLayerRadiusConflicts(l);
        // Always ensure an explicit meters radius when repairing this layer.
        // Stripping getRadius without setting radius leaves deck.gl's default
        // (1000), which is enormous at city scale. Do not overwrite a string
        // radius — that is a validator issue.
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

/**
 * Fixes common AI layer mistakes that are safe, unambiguous defaults:
 * 1. Missing _sqlroomsBinding.dataset when there is exactly one dataset
 * 2. colorRange on GeoArrowHeatmapLayer (AI hand-craft; UI scheme selector owns it)
 * 3. Missing getFillColor on filled layers (deck.gl defaults to opaque black)
 * 4. Scheme-name casing on valid colorScale accessors
 * 5. Lift getHexagon "@@=column" into hexagonColumn for fit-to-bounds
 *
 * Rejected by getDeckMapResourceConfigIssues (agent retry): unprefixed layer
 * classes, ColorScale @@type/column syntax, heatmap getWeight (basic mode /
 * column accessors), object getHexagon, arc getSourcePosition/getTargetPosition,
 * mapbox:// mapStyle, and basic-mode string getRadius / getWidth /
 * getElevation / radiusPixels / column radius.
 */
function normalizeAiMapConfigLayers(config: AiMapConfig): AiMapConfig {
  const spec = config.spec as Record<string, unknown> | undefined;
  if (!spec || !Array.isArray(spec.layers)) return config;

  // Collect the single dataset id if and only if there is exactly one.
  const datasetIds = config.datasets ? Object.keys(config.datasets) : [];
  const soloDatasetId = datasetIds.length === 1 ? datasetIds[0] : undefined;

  let changed = false;
  const layers = spec.layers.map((layer: unknown) => {
    if (!layer || typeof layer !== 'object' || Array.isArray(layer)) {
      return layer;
    }
    let l = layer as Record<string, unknown>;
    let layerChanged = false;

    // Alias: scaleLinear → scale only for getElevation. The Deck JSON
    // preprocessor compiles scale markers for elevation; radius/width scale
    // objects would reach deck.gl as broken accessors — leave them for the
    // validator / agent retry.
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

    // Normalise color accessor scheme names: AI often sends wrong casing
    // (e.g. "blues", "viridis"). Do a case-insensitive lookup and replace with
    // the canonical name so the color-scale renderer can find the interpolator.
    // Also trim type/scheme so whitespace does not pass validation then fail
    // at render. Type/scheme compatibility (e.g. quantile + Viridis) is
    // rejected by getDeckMapResourceConfigIssues — agent retry, not silent coerce.
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

    // Auto-inject or fix _sqlroomsBinding.dataset when there is exactly one
    // dataset in the config (the intent is unambiguous):
    // - Layer has no binding / missing dataset → inject it.
    // - Layer references a dataset ID that doesn't exist in config.datasets
    //   (AI typo or stale name) → replace it with the real ID.
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

    // Strip colorRange from heatmap layers on AI normalize. The UI scheme
    // selector owns that array after the user picks a scheme; hand-crafted AI
    // RGB values bypass it and produce incorrect coloring. Do not put this in
    // getDeckMapResourceConfigIssues — persisted UI configs legitimately set
    // colorRange.
    if (l['@@type'] === 'GeoArrowHeatmapLayer' && 'colorRange' in l) {
      const {colorRange: _cr, ...rest} = l;
      l = rest;
      layerChanged = true;
    }

    // Lift getHexagon "@@=column" into _sqlroomsBinding.hexagonColumn so
    // fit-to-bounds can find the column. Object getHexagon syntax is rejected
    // by getDeckMapResourceConfigIssues.
    if (l['@@type'] === 'GeoArrowH3HexagonLayer') {
      const hexAccessor = l.getHexagon;
      let hexColumn: string | undefined;
      if (typeof hexAccessor === 'string') {
        const m = hexAccessor.match(/^@@=(.+)$/);
        hexColumn = m ? m[1]!.trim() : undefined;
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

    // GeoArrowColumnLayer: when elevation is driven by a field, ensure
    // extruded is on (deck default is true, but AI often omits it after
    // toggling other props).
    if (
      l['@@type'] === 'GeoArrowColumnLayer' &&
      l.getElevation !== undefined &&
      l.extruded === undefined
    ) {
      l = {...l, extruded: true};
      layerChanged = true;
    }

    // Inject default getFillColor for scatterplot/polygon layers that omit it
    // entirely. Without it deck.gl falls back to opaque black [0,0,0,255].
    // Mirror the same sky-blue default used by the UI builder.
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

    // Prevent invisible scatterplot points: if filled is explicitly false but
    // stroked is also absent/false, the layer renders nothing. Reset filled.
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

  // Do not delete layers with visible:false. That is legitimate user state
  // (settings visibility toggle). Type switches should use replaceLayers:true
  // (prompt + validator), not silent deletion on normalize.

  if (!changed) return config;
  return {...config, spec: {...spec, layers} as typeof spec};
}

/**
 * Splits a (possibly quoted) SQL table reference on dots that are not inside
 * double-quoted identifiers, e.g.:
 *   "sqlrooms-cli"."main"."tbl"  →  ['"sqlrooms-cli"', '"main"', '"tbl"']
 *   catalog.schema.table         →  ['catalog', 'schema', 'table']
 */
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

/**
 * Strips configured workspace catalog prefixes from dataset tableName values
 * (e.g. `sqlrooms-cli.main.my_table` when `stripCatalogNames` includes
 * `sqlrooms-cli`). Attached/remote three-part catalogs are preserved unless
 * listed — the table SQL builder accepts quoted multi-part references.
 *
 * Catalog names are host-injected: `@sqlrooms/deck` does not hardcode app
 * catalog identities.
 */
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

  // Per arc-bound dataset: geometry column names that must decode as WKB.
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

    // Fix missing geometryEncodingHint for arc datasets bound to this id.
    // Scope by dataset so an arc column name like "geom" cannot mark an
    // unrelated polygon dataset as WKB.
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

/**
 * Normalizes an AI-generated map config to ensure dataset sources produce
 * the expected geometry column when fitToData specifies coordinate columns
 * but the dataset only uses a tableName without a transformSql.
 */
function normalizeAiMapConfig(config: AiMapConfig): AiMapConfig {
  // mapbox:// mapStyle is rejected by getDeckMapResourceConfigIssues (agent
  // retry) and skipped at resolve time — do not strip it silently here.

  const datasets = config.datasets;
  let fitToData = config.fitToData as
    | Record<string, unknown>
    | null
    | undefined;

  // Fix common AI mistake: fitToData wrapped as { datasetId: { dataset, ... } }
  // instead of the expected flat { dataset, longitudeColumn, ... }.
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

  // Inject fitToData when the AI omits it. Without fitToData the fit-to-bounds
  // button stays disabled and H3/point maps often open fully zoomed out.
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

  // Always normalize when using tableName without transformSql and fitToData
  // provides coordinate columns — the geometry must be computed from them.
  if (!source?.tableName || source.sqlQuery || source.transformSql) {
    return config;
  }

  const geometryColumn =
    (targetDataset.geometryColumn as string | undefined) ||
    DEFAULT_AI_GEOMETRY_COLUMN;

  const quotedLon = quoteDeckMapSqlIdentifier(lonCol);
  const quotedLat = quoteDeckMapSqlIdentifier(latCol);
  const quotedGeom = quoteDeckMapSqlIdentifier(geometryColumn);
  const transformSql = [
    `SELECT *, ST_AsWKB(ST_Point(${quotedLon}, ${quotedLat})) AS ${quotedGeom}`,
    `FROM ${DECK_TABLE_DATASET_SOURCE_RELATION}`,
    `WHERE ${quotedLon} IS NOT NULL AND ${quotedLat} IS NOT NULL`,
  ].join(' ');

  return {
    ...config,
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
 * Applies AI-output normalization passes to a map config in one step.
 *
 * Safe to call on any surface — worksheet, dashboard, or block document. Each
 * pass is idempotent and leaves already-correct configs unchanged:
 * - scheme-name casing on colorScale accessors (e.g. "blues" → "Blues")
 * - zero/negative getRadius in basic-mode scatterplot layers → numeric default
 * - numeric getWidth without widthUnits:pixels in basic-mode line layers → inject
 * - zero/negative radiusPixels on heatmap layers → default
 * - missing/zero radius on column layers → default meters (+ strip point radius leaks)
 * - missing or wrong _sqlroomsBinding.dataset when only one dataset → auto-inject
 * - colorRange on GeoArrowHeatmapLayer → stripped (UI scheme selector owns it)
 * - getHexagon "@@=column" on GeoArrowH3HexagonLayer → lifted into _sqlroomsBinding.hexagonColumn
 * - missing fitToData → injected from the sole dataset or first layer binding
 * - GeoArrowArcLayer dataset: missing geometryEncodingHint → injected when transformSql mentions arc geom cols
 * - missing getFillColor on scatterplot/polygon layers → default sky-blue
 * - filled:false with no stroke on scatterplot → reset to filled:true
 * - optional catalog prefixes stripped from dataset tableName when
 *   `stripCatalogNames` is provided by the host
 * - fitToData coordinate-column → transformSql injection when transformSql is absent
 *
 * Not rewritten here (validator + agent retry): unprefixed layer class names,
 * colorScale {"@@type":"ColorScale","column":"..."} syntax, type/scheme
 * mismatches (e.g. quantile + Viridis), SELECT * / ST_AsWKB alias collisions,
 * heatmap getWeight (omit for default density), object getHexagon, arc
 * getSourcePosition/getTargetPosition, mapbox:// mapStyle, and basic-mode
 * string getRadius / getWidth / getElevation / radiusPixels / column radius.
 */
export type NormalizeAiDeckMapConfigOptions = {
  /**
   * Catalog names to strip from three-part `tableName` refs (case-insensitive).
   * Hosts inject workspace catalogs that do not exist in the dataset query
   * context (e.g. CLI passes `['sqlrooms-cli']`). Empty/omitted → no stripping.
   */
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
 * Walks the map config and checks every colorScale `field` against the source
 * table's column list (when available via `resolveTable`).
 *
 * - Wrong casing (e.g. "magnitude" → "Magnitude") → fixed when the field
 *   matches a base-table column case-insensitively (even with transformSql).
 * - Unknown field on a bare `{tableName}` source → throws with available
 *   columns so the agent can retry.
 * - Unknown field when `transformSql` / `sqlQuery` is present → skipped.
 *   Derived SQL can introduce aliases the base table does not have; rejecting
 *   against the base schema would false-fail those configs.
 * - Pure `sqlQuery`-only sources (no `tableName`) → skipped.
 *
 * Call this **before** {@link normalizeAiDeckMapConfig} when possible: normalize
 * may inject `transformSql` for lon/lat tables, which would otherwise disable
 * unknown-field rejection for the common bare-table path.
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
    // Mirror normalize: omit → sole dataset; unknown/typo solo binding → sole
    // real dataset (normalize replaces it before render).
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
        // Wrong casing is unambiguous and reversible — fix silently.
        nextLayer = {
          ...(nextLayer ?? layer),
          [prop]: {...acc, field: canonical},
        };
        changed = true;
        continue;
      }
      if (!cols.rejectUnknown) {
        // Derived SQL may introduce aliases. Allow fields mentioned in the SQL
        // text; reject typos that match neither the base table nor the SQL.
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
 * Shared AI map-config prepare: validate colorScale fields against known
 * tables (when a resolver is provided), then run {@link normalizeAiDeckMapConfig}.
 * Validation runs first so lon/lat `transformSql` injection does not disable
 * unknown-field checks on bare `{tableName}` sources.
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
