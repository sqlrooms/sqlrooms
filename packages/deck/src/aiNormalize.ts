import {allKnownColorSchemeNames} from '@sqlrooms/color-scales/colorSchemeNames';

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
const DEFAULT_AI_COLUMN_RADIUS_METERS = 50; // city-scale default
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

    if (
      l['@@type'] === 'GeoArrowScatterplotLayer' &&
      typeof l.getRadius === 'number' &&
      l.getRadius <= 0
    ) {
      changed = true;
      return {...l, getRadius: DEFAULT_AI_POINT_RADIUS};
    }

    const LINE_LAYER_TYPES = new Set([
      'GeoArrowPathLayer',
      'GeoArrowArcLayer',
      'GeoArrowTripsLayer',
    ]);

    // Enforce widthUnits: "pixels" when getWidth is numeric but widthUnits is
    // absent or set to meters. Meter-based widths scale with zoom and produce
    // wildly different visual thicknesses at different zoom levels.
    if (
      typeof l['@@type'] === 'string' &&
      LINE_LAYER_TYPES.has(l['@@type']) &&
      typeof l.getWidth === 'number' &&
      l.widthUnits !== 'pixels'
    ) {
      changed = true;
      return {...l, widthUnits: 'pixels'};
    }

    // Fix inverted width clamps (max < min) that silently cap rendered width
    // below the UI slider range.
    if (
      typeof l['@@type'] === 'string' &&
      LINE_LAYER_TYPES.has(l['@@type']) &&
      typeof l.widthMinPixels === 'number' &&
      typeof l.widthMaxPixels === 'number' &&
      l.widthMaxPixels < l.widthMinPixels
    ) {
      changed = true;
      const value = Math.max(
        l.widthMinPixels,
        l.widthMaxPixels,
        typeof l.getWidth === 'number' ? l.getWidth : 0,
      );
      const next: Record<string, unknown> = {
        ...l,
        widthUnits: 'pixels',
        widthMinPixels: value,
        widthMaxPixels: value,
      };
      if (typeof l.getWidth === 'number') {
        next.getWidth = value;
      }
      return next;
    }

    // Clamp heatmap radiusPixels: zero/negative values produce an invisible
    // heatmap. String expressions are rejected by the validator.
    if (l['@@type'] === 'GeoArrowHeatmapLayer') {
      const rp = l.radiusPixels;
      if (typeof rp === 'number' && rp <= 0) {
        changed = true;
        return {...l, radiusPixels: DEFAULT_AI_HEATMAP_RADIUS_PIXELS};
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
      const hasPixelUnits = l.radiusUnits === 'pixels';
      const hasPointRadiusLeak =
        l.getRadius !== undefined ||
        l.radiusMinPixels !== undefined ||
        l.radiusMaxPixels !== undefined ||
        l.radiusPixels !== undefined;
      if (needsDefaultRadius || hasPixelUnits || hasPointRadiusLeak) {
        changed = true;
        const next: Record<string, unknown> = {...l};
        // Always ensure an explicit meters radius when repairing this layer.
        // Stripping getRadius without setting radius leaves deck.gl's default
        // (1000), which is enormous at city scale. Do not overwrite a string
        // radius — that is a validator issue.
        if (needsDefaultRadius) {
          next.radius = DEFAULT_AI_COLUMN_RADIUS_METERS;
        }
        next.radiusUnits = 'meters';
        delete next.getRadius;
        delete next.radiusMinPixels;
        delete next.radiusMaxPixels;
        delete next.radiusPixels;
        l = next;
      }
    }

    if (changed && l !== layer) {
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
 * classes, ColorScale @@type/column syntax, object getWeight, object
 * getHexagon, arc getSourcePosition/getTargetPosition, and basic-mode string
 * getRadius / getWidth / getElevation / radiusPixels / column radius.
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

    // Normalise color accessor scheme names: AI often sends wrong casing
    // (e.g. "blues", "viridis"). Do a case-insensitive lookup and replace with
    // the canonical name so the color-scale renderer can find the interpolator.
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
        const rawScheme = v.scheme;
        if (typeof rawScheme === 'string') {
          const canonical = SCHEME_NAME_BY_LOWER.get(rawScheme.toLowerCase());
          if (canonical && canonical !== rawScheme) {
            l = {...l, [prop]: {...v, scheme: canonical}};
            layerChanged = true;
          }
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
 * Strips the catalog prefix from dataset tableName values.
 * DuckDB's catalog prefix (e.g. "sqlrooms-cli.main.my_table") is not valid
 * inside dataset SQL — only the bare name or schema-qualified name is.
 */
function normalizeAiMapConfigDatasetSources(config: AiMapConfig): AiMapConfig {
  const datasets = config.datasets;
  if (!datasets || typeof datasets !== 'object') return config;

  // Collect geometry column names used by arc layers so we can check their
  // transformSql and ensure geometryEncodingHint is set to "wkb".
  const arcGeomCols = new Set<string>();
  const spec = config.spec as Record<string, unknown> | undefined;
  if (spec && Array.isArray(spec.layers)) {
    for (const layer of spec.layers) {
      if (!layer || typeof layer !== 'object') continue;
      const l = layer as Record<string, unknown>;
      if (l['@@type'] !== 'GeoArrowArcLayer') continue;
      const binding = l._sqlroomsBinding as Record<string, unknown> | undefined;
      if (typeof binding?.sourceGeometryColumn === 'string')
        arcGeomCols.add(binding.sourceGeometryColumn);
      if (typeof binding?.targetGeometryColumn === 'string')
        arcGeomCols.add(binding.targetGeometryColumn);
    }
  }

  let changed = false;
  const nextDatasets: Record<string, unknown> = {};

  for (const [id, dataset] of Object.entries(datasets)) {
    const d = dataset as Record<string, unknown> | undefined;
    const source = d?.source as Record<string, unknown> | undefined;
    const tableName = source?.tableName;

    let next = d;

    if (typeof tableName === 'string') {
      const parts = splitTableRef(tableName);
      if (parts.length >= 3) {
        const stripped = parts.slice(1).join('.');
        next = {...next, source: {...source, tableName: stripped}};
        changed = true;
      }
    }

    // Fix missing geometryEncodingHint for arc datasets.
    // If the transformSql defines arc geometry columns (detected above), the
    // dataset must declare geometryEncodingHint: "wkb" so the decoder knows
    // how to read the geometry. Do not silently rewrite SQL — validator +
    // agent retry own ST_AsWKB / ST_MakeLine(LIST(...)) corrections.
    const transformSql = (next?.source as Record<string, unknown> | undefined)
      ?.transformSql as string | undefined;

    if (
      arcGeomCols.size > 0 &&
      typeof transformSql === 'string' &&
      !next?.geometryEncodingHint
    ) {
      // Only inject when the transformSql references at least one of the
      // arc geometry columns — avoids touching unrelated datasets.
      const mentionsArcCol = [...arcGeomCols].some((col) =>
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
 * - catalog prefix stripped from dataset tableName values
 * - fitToData coordinate-column → transformSql injection when transformSql is absent
 *
 * Not rewritten here (validator + agent retry): unprefixed layer class names,
 * colorScale {"@@type":"ColorScale","column":"..."} syntax, object getWeight,
 * object getHexagon, arc getSourcePosition/getTargetPosition, and basic-mode
 * string getRadius / getWidth / getElevation / radiusPixels / column radius.
 */
export function normalizeAiDeckMapConfig<T extends Record<string, unknown>>(
  config: T,
): T {
  return normalizeAiMapConfigRadius(
    normalizeAiMapConfigLayers(
      normalizeAiMapConfigDatasetSources(
        normalizeAiMapConfig(config as unknown as AiMapConfig),
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

/**
 * Walks the merged map config and validates every colorScale `field` against
 * the source table's actual column list (when available via `resolveTable`).
 *
 * Datasets with a `tableName` are validated against that table's columns, even
 * when `transformSql` / `sqlQuery` is also present (common lon/lat → WKB
 * transforms keep base columns via `SELECT *`). Pure `sqlQuery`-only sources
 * without `tableName` are skipped because their output schema is unknown.
 *
 * Outcomes:
 * - Correct field name → no change.
 * - Wrong casing (e.g. "magnitude" → "Magnitude") → fixed silently.
 * - Unknown field (e.g. "mag" when the column is "Magnitude") → throws with
 *   a message listing the available columns so the AI can retry correctly.
 */
export function validateAndFixColorScaleFields<
  T extends {spec?: unknown; datasets?: Record<string, unknown>},
>(
  config: T,
  resolveTable: (tableName: string) => {columns?: {name: string}[]} | undefined,
): T {
  const spec = config.spec;
  if (!spec || typeof spec === 'string') return config;
  const layers = Array.isArray((spec as Record<string, unknown>).layers)
    ? ((spec as Record<string, unknown>).layers as Record<string, unknown>[])
    : [];

  const columnsByDataset = new Map<string, Map<string, string>>();
  for (const [datasetId, dataset] of Object.entries(config.datasets ?? {})) {
    const source = (dataset as Record<string, unknown>)?.source as
      | Record<string, unknown>
      | undefined;
    if (!source) continue;
    const tableName =
      typeof source.tableName === 'string' ? source.tableName : undefined;
    // Validate against the base table whenever tableName is known — even if
    // transformSql/sqlQuery is present. Common point transforms are SELECT *
    // plus geometry, so colorScale fields still come from the source table.
    // Pure sqlQuery-only datasets (no tableName) are skipped.
    if (!tableName) continue;

    const table = resolveTable(tableName);
    if (!table?.columns?.length) continue;

    const byLower = new Map<string, string>();
    for (const col of table.columns) {
      byLower.set(col.name.toLowerCase(), col.name);
    }
    columnsByDataset.set(datasetId, byLower);
  }

  if (columnsByDataset.size === 0) return config;

  const errors: string[] = [];
  let changed = false;
  const nextLayers = layers.map((layer, i) => {
    const binding = layer._sqlroomsBinding as
      | Record<string, unknown>
      | undefined;
    const datasetId =
      typeof binding?.dataset === 'string' ? binding.dataset : undefined;
    const colMap = datasetId ? columnsByDataset.get(datasetId) : undefined;
    if (!colMap) return layer;

    let nextLayer: Record<string, unknown> | undefined;
    for (const prop of COLOR_SCALE_ACCESSOR_PROPS) {
      const accessor = (nextLayer ?? layer)[prop];
      if (!accessor || typeof accessor !== 'object' || Array.isArray(accessor))
        continue;
      const acc = accessor as Record<string, unknown>;
      if (acc['@@function'] !== 'colorScale') continue;
      const field = acc.field;
      if (typeof field !== 'string') continue;

      const canonical = colMap.get(field.toLowerCase());
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
      const available = [...colMap.values()].join(', ');
      errors.push(
        `spec.layers.${i}.${prop}: colorScale field "${field}" is not a column in dataset "${datasetId}". Available columns: ${available}`,
      );
    }
    return nextLayer ?? layer;
  });

  if (errors.length > 0) {
    throw new Error(errors.join('; '));
  }

  if (!changed) return config;
  return {
    ...config,
    spec: {
      ...(spec as Record<string, unknown>),
      layers: nextLayers,
    },
  } as T;
}
