// Inlined to keep this module free of heavy workspace-package imports
// (e.g. @sqlrooms/duckdb, @sqlrooms/mosaic) that would break Jest.
// The list below must be kept in sync with packages/color-scales/src/colorSchemeNames.ts.
const DECK_TABLE_DATASET_SOURCE_RELATION = '__sqlrooms_source';
function quoteDeckMapSqlIdentifier(identifier: string) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

const ALL_KNOWN_SCHEMES = [
  // sequential
  'Blues',
  'BuGn',
  'BuPu',
  'Cividis',
  'Cool',
  'CubehelixDefault',
  'GnBu',
  'Greens',
  'Greys',
  'Inferno',
  'Magma',
  'OrRd',
  'Oranges',
  'Plasma',
  'PuBu',
  'PuBuGn',
  'PuRd',
  'Purples',
  'RdPu',
  'Reds',
  'Turbo',
  'Viridis',
  'Warm',
  'YlGn',
  'YlGnBu',
  'YlOrBr',
  'YlOrRd',
  'Rainbow',
  'Sinebow',
  // diverging
  'BrBG',
  'PRGn',
  'PiYG',
  'PuOr',
  'RdBu',
  'RdGy',
  'RdYlBu',
  'RdYlGn',
  'Spectral',
  // categorical
  'Accent',
  'Dark2',
  'Paired',
  'Pastel1',
  'Pastel2',
  'Set1',
  'Set2',
  'Set3',
  'Tableau10',
  'Observable10',
  'Category10',
] as const;

/** Lower-cased name → canonical casing, e.g. "blues" → "Blues". */
const SCHEME_NAME_BY_LOWER = new Map(
  ALL_KNOWN_SCHEMES.map((s) => [s.toLowerCase(), s]),
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
const DEFAULT_AI_LINE_WIDTH = 2;
const DEFAULT_AI_HEATMAP_RADIUS_PIXELS = 30; // matches deck.gl default
const DEFAULT_AI_COLUMN_RADIUS_METERS = 50; // city-scale default
/** Sky-blue default fill — matches the UI builder's DEFAULT_FILL_COLOR. */
const DEFAULT_FILL_COLOR = [56, 189, 248, 180] as const;

/**
 * Strips string-expression getRadius/getWidth from basic-mode layer configs.
 * String expressions bypass pixel-mode clamping:
 * - getRadius on GeoArrowScatterplotLayer produces enormous uncontrollable points.
 * - getWidth on GeoArrowPathLayer/ArcLayer/TripsLayer produces enormous lines.
 * The UI sliders only work with numeric values.
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
    const l = layer as Record<string, unknown>;

    if (
      l['@@type'] === 'GeoArrowScatterplotLayer' &&
      typeof l.getRadius === 'string'
    ) {
      changed = true;
      const next = {...l};
      delete next.radiusScale;
      next.getRadius = DEFAULT_AI_POINT_RADIUS;
      next.radiusUnits = 'pixels';
      if (typeof next.radiusMinPixels !== 'number') {
        next.radiusMinPixels = DEFAULT_AI_POINT_RADIUS;
      }
      delete next.radiusMaxPixels;
      return next;
    }

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
    if (
      typeof l['@@type'] === 'string' &&
      LINE_LAYER_TYPES.has(l['@@type']) &&
      typeof l.getWidth === 'string'
    ) {
      changed = true;
      const next = {...l};
      delete next.widthScale;
      next.getWidth = DEFAULT_AI_LINE_WIDTH;
      next.widthUnits = 'pixels';
      if (typeof next.widthMinPixels !== 'number') {
        next.widthMinPixels = DEFAULT_AI_LINE_WIDTH;
      }
      delete next.widthMaxPixels;
      return next;
    }

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

    // Clamp heatmap radiusPixels: string expressions or zero/negative values
    // produce an invisible or broken heatmap.
    if (l['@@type'] === 'GeoArrowHeatmapLayer') {
      const rp = l.radiusPixels;
      if (typeof rp === 'string' || (typeof rp === 'number' && rp <= 0)) {
        changed = true;
        return {...l, radiusPixels: DEFAULT_AI_HEATMAP_RADIUS_PIXELS};
      }
    }

    // Clamp column radius (meters): string expressions or zero/negative values
    // produce invisible columns.
    if (l['@@type'] === 'GeoArrowColumnLayer') {
      const r = l.radius;
      if (typeof r === 'string' || (typeof r === 'number' && r <= 0)) {
        changed = true;
        return {...l, radius: DEFAULT_AI_COLUMN_RADIUS_METERS};
      }
    }

    // Strip string getElevation in basic mode. String accessors bypass the UI
    // elevation slider. Reset to 0 (flat, non-extruded) and clear elevationScale
    // so the layer is at least visible; the user can re-enable extrusion via UI.
    const ELEVATION_LAYER_TYPES = new Set([
      'GeoArrowPolygonLayer',
      'GeoArrowSolidPolygonLayer',
      'GeoArrowColumnLayer',
      'GeoArrowH3HexagonLayer',
    ]);
    if (
      typeof l['@@type'] === 'string' &&
      ELEVATION_LAYER_TYPES.has(l['@@type']) &&
      typeof l.getElevation === 'string'
    ) {
      changed = true;
      const next = {...l};
      next.getElevation = 0;
      delete next.elevationScale;
      return next;
    }

    return layer;
  });

  if (!changed) return config;
  return {...config, spec: {...spec, layers} as typeof spec};
}

/** Maps common AI layer class name mistakes to the correct GeoArrow class names. */
const LAYER_CLASS_ALIASES: Record<string, string> = {
  ScatterplotLayer: 'GeoArrowScatterplotLayer',
  HeatmapLayer: 'GeoArrowHeatmapLayer',
  ColumnLayer: 'GeoArrowColumnLayer',
  PathLayer: 'GeoArrowPathLayer',
  PolygonLayer: 'GeoArrowPolygonLayer',
  SolidPolygonLayer: 'GeoArrowSolidPolygonLayer',
  ArcLayer: 'GeoArrowArcLayer',
  TripsLayer: 'GeoArrowTripsLayer',
  H3HexagonLayer: 'GeoArrowH3HexagonLayer',
};

const COLOR_ACCESSOR_PROPS = [
  'getFillColor',
  'getLineColor',
  'getColor',
  'getSourceColor',
  'getTargetColor',
] as const;

/**
 * Fixes common AI layer mistakes:
 * 1. Plain deck.gl class names without the GeoArrow prefix.
 * 2. Color accessors using wrong syntax: {"@@type":"ColorScale","column":"..."} instead
 *    of {"@@function":"colorScale","field":"..."}.
 * 3. Missing _sqlroomsBinding.dataset when there is exactly one dataset in the config
 *    (unambiguous — inject it automatically).
 * 4. colorRange on GeoArrowHeatmapLayer (owned by the UI scheme selector).
 * 5. Missing getFillColor on filled layers (deck.gl defaults to opaque black).
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

    // Fix layer class name alias
    const rawType = l['@@type'];
    if (typeof rawType === 'string' && LAYER_CLASS_ALIASES[rawType]) {
      l = {...l, '@@type': LAYER_CLASS_ALIASES[rawType]};
      layerChanged = true;
    }

    // Fix color accessor syntax: {"@@type":"ColorScale","column":"X"} → {"@@function":"colorScale","field":"X"}
    for (const prop of COLOR_ACCESSOR_PROPS) {
      const value = l[prop];
      if (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        (value as Record<string, unknown>)['@@type'] === 'ColorScale' &&
        !('@@function' in (value as Record<string, unknown>))
      ) {
        const v = value as Record<string, unknown>;
        const field =
          typeof v.column === 'string'
            ? v.column
            : typeof v.field === 'string'
              ? v.field
              : undefined;
        if (field) {
          const {column: _col, '@@type': _t, ...rest} = v;
          l = {
            ...l,
            [prop]: {
              '@@function': 'colorScale',
              field,
              type: typeof rest.type === 'string' ? rest.type : 'sequential',
              scheme: typeof rest.scheme === 'string' ? rest.scheme : 'Viridis',
              domain: 'auto',
              ...('legend' in rest ? {legend: rest.legend} : {}),
            },
          };
          layerChanged = true;
        } else {
          // Can't repair — remove the broken accessor to avoid a parse failure
          const {[prop]: _removed, ...rest} = l;
          l = rest;
          layerChanged = true;
        }
      }
    }

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

    // Strip colorRange from heatmap layers. The UI scheme selector owns that
    // array; hand-crafted RGB values bypass it and produce incorrect coloring.
    if (l['@@type'] === 'GeoArrowHeatmapLayer' && 'colorRange' in l) {
      const {colorRange: _cr, ...rest} = l;
      l = rest;
      layerChanged = true;
    }

    // Fix invalid getWeight on GeoArrowHeatmapLayer. The AI sometimes generates
    // {"@@function":"getNumericColumn","field":"..."} which is not a real accessor.
    // The correct form is a deck.gl attribute string "@@=ColumnName".
    if (l['@@type'] === 'GeoArrowHeatmapLayer') {
      const gw = l.getWeight;
      if (
        gw &&
        typeof gw === 'object' &&
        !Array.isArray(gw) &&
        '@@function' in (gw as Record<string, unknown>) &&
        (gw as Record<string, unknown>)['@@function'] !== 'colorScale'
      ) {
        // Extract the field name from common AI patterns and convert to @@= accessor.
        const field =
          (gw as Record<string, unknown>).field ??
          (gw as Record<string, unknown>).column;
        if (typeof field === 'string' && field.trim()) {
          l = {...l, getWeight: `@@=${field}`};
          layerChanged = true;
        } else {
          // Unknown object accessor — remove it so the heatmap renders unweighted
          // rather than failing silently.
          const {getWeight: _gw, ...rest} = l;
          l = rest;
          layerChanged = true;
        }
      }
    }

    // Fix invalid getHexagon on GeoArrowH3HexagonLayer. The AI sometimes
    // generates {"@@function":"columnAccessor","column":"..."} which is not a
    // real accessor. The correct form is a deck.gl attribute string "@@=column".
    if (l['@@type'] === 'GeoArrowH3HexagonLayer') {
      const gh = l.getHexagon;
      if (
        gh &&
        typeof gh === 'object' &&
        !Array.isArray(gh) &&
        '@@function' in (gh as Record<string, unknown>) &&
        (gh as Record<string, unknown>)['@@function'] !== 'colorScale'
      ) {
        const field =
          (gh as Record<string, unknown>).field ??
          (gh as Record<string, unknown>).column;
        if (typeof field === 'string' && field.trim()) {
          l = {...l, getHexagon: `@@=${field}`};
          layerChanged = true;
        } else {
          // Can't recover — remove so validation gives a clear error message.
          const {getHexagon: _gh, ...rest} = l;
          l = rest;
          layerChanged = true;
        }
      }
    }

    // Fix GeoArrowArcLayer: the AI sometimes places geometry columns as
    // getSourcePosition/getTargetPosition string accessors ("@@=col") instead
    // of in _sqlroomsBinding.sourceGeometryColumn / targetGeometryColumn.
    // Lift them into the binding so the GeoArrow pipeline can find them.
    if (l['@@type'] === 'GeoArrowArcLayer') {
      const binding =
        l._sqlroomsBinding &&
        typeof l._sqlroomsBinding === 'object' &&
        !Array.isArray(l._sqlroomsBinding)
          ? (l._sqlroomsBinding as Record<string, unknown>)
          : undefined;

      const extractCol = (accessor: unknown): string | undefined => {
        if (typeof accessor === 'string') {
          const m = accessor.match(/^@@=(.+)$/);
          return m ? m[1]!.trim() : undefined;
        }
        if (
          accessor &&
          typeof accessor === 'object' &&
          !Array.isArray(accessor)
        ) {
          const a = accessor as Record<string, unknown>;
          const col = a.column ?? a.field;
          return typeof col === 'string' ? col.trim() : undefined;
        }
        return undefined;
      };

      const srcCol = extractCol(l.getSourcePosition);
      const tgtCol = extractCol(l.getTargetPosition);

      const missingSrc =
        !binding?.sourceGeometryColumn && typeof srcCol === 'string' && srcCol;
      const missingTgt =
        !binding?.targetGeometryColumn && typeof tgtCol === 'string' && tgtCol;

      if (missingSrc || missingTgt) {
        const newBinding: Record<string, unknown> = {...(binding ?? {})};
        if (missingSrc) newBinding.sourceGeometryColumn = srcCol;
        if (missingTgt) newBinding.targetGeometryColumn = tgtCol;
        // Remove the (now redundant) string accessor props from the layer.
        const {getSourcePosition: _sp, getTargetPosition: _tp, ...rest} = l;
        l = {...rest, _sqlroomsBinding: newBinding};
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

  // Remove layers that the AI hid with visible:false when other layers of a
  // different @@type are visible. This is the "type switch shadow" pattern:
  // instead of replacing the old layer, the AI adds a new one and hides the old.
  const visibleLayers = layers.filter(
    (l) =>
      typeof l === 'object' &&
      l !== null &&
      (l as Record<string, unknown>).visible !== false,
  );
  const hiddenWithDifferentType = layers.filter((l) => {
    if (typeof l !== 'object' || l === null) return false;
    const lr = l as Record<string, unknown>;
    if (lr.visible !== false) return false;
    const hiddenType = lr['@@type'];
    return visibleLayers.some(
      (v) =>
        typeof v === 'object' &&
        v !== null &&
        (v as Record<string, unknown>)['@@type'] !== hiddenType,
    );
  });
  if (hiddenWithDifferentType.length > 0) {
    const filteredLayers = layers.filter(
      (l) => !hiddenWithDifferentType.includes(l),
    );
    return {
      ...config,
      spec: {...spec, layers: filteredLayers} as typeof spec,
    };
  }

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
    // If the transformSql defines arc geometry columns (detected above) using
    // ST_Point/ST_AsWKB/etc., the dataset must declare geometryEncodingHint:
    // "wkb" so the decoder knows how to read the geometry.
    const transformSql = (next?.source as Record<string, unknown> | undefined)
      ?.transformSql as string | undefined;
    if (arcGeomCols.size > 0 && transformSql && !next?.geometryEncodingHint) {
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

    // Fix transformSql that uses bare ST_Point() instead of ST_AsWKB(ST_Point()).
    // This is the most common mistake for arc layers: the AI omits ST_AsWKB().
    if (transformSql && arcGeomCols.size > 0) {
      // Replace "ST_Point(...) AS col" → "ST_AsWKB(ST_Point(...)) AS col"
      // only for the arc geometry columns. Uses a conservative regex that
      // matches the alias at the end and avoids double-wrapping.
      let fixedSql = transformSql;
      for (const col of arcGeomCols) {
        // Match: ST_Point(<args>) as col  (case-insensitive, optional quotes)
        // Not already wrapped with ST_AsWKB.
        fixedSql = fixedSql.replace(
          new RegExp(
            `(?<!ST_AsWKB\\()(ST_Point\\([^)]+\\))\\s+[Aa][Ss]\\s+"?${col}"?`,
            'g',
          ),
          `ST_AsWKB($1) AS "${col}"`,
        );
      }
      if (fixedSql !== transformSql) {
        next = {
          ...next,
          source: {
            ...(next?.source as Record<string, unknown>),
            transformSql: fixedSql,
          },
        };
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
 * Applies all AI-output normalization passes to a map config in one step.
 *
 * Safe to call on any surface — worksheet, dashboard, or block document. Each
 * pass is idempotent and leaves already-correct configs unchanged:
 * - layer class aliases (ScatterplotLayer → GeoArrowScatterplotLayer, etc.)
 * - color accessor syntax (@@type: ColorScale → @@function: colorScale, column → field)
 * - string/zero getRadius in basic-mode scatterplot layers → numeric default
 * - string/zero getWidth in basic-mode line layers → numeric default + pixels units
 * - string/zero radiusPixels on heatmap layers → default
 * - string/zero radius on column layers → default meters
 * - string getElevation in basic mode → 0 (flat)
 * - missing or wrong _sqlroomsBinding.dataset when only one dataset → auto-inject
 * - colorRange on GeoArrowHeatmapLayer → stripped
 * - invalid getWeight object accessor on GeoArrowHeatmapLayer → converted to "@@=field" string
 * - invalid getHexagon object accessor on GeoArrowH3HexagonLayer → converted to "@@=column" string
 * - GeoArrowArcLayer getSourcePosition/getTargetPosition string accessors → lifted into _sqlroomsBinding
 * - GeoArrowArcLayer dataset: missing ST_AsWKB wrapping on ST_Point → added; missing geometryEncodingHint → injected
 * - missing getFillColor on scatterplot/polygon layers → default sky-blue
 * - filled:false with no stroke on scatterplot → reset to filled:true
 * - catalog prefix stripped from dataset tableName values
 * - fitToData coordinate-column → transformSql injection when transformSql is absent
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
 * Only simple `tableName`-backed datasets (no `transformSql` / `sqlQuery`)
 * have a known column list at write time. SQL-derived datasets are skipped.
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
    const hasTransform =
      typeof source.transformSql === 'string' ||
      typeof source.sqlQuery === 'string';
    if (!tableName || hasTransform) continue;

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
  for (const [i, layer] of layers.entries()) {
    const binding = layer._sqlroomsBinding as
      | Record<string, unknown>
      | undefined;
    const datasetId =
      typeof binding?.dataset === 'string' ? binding.dataset : undefined;
    const colMap = datasetId ? columnsByDataset.get(datasetId) : undefined;
    if (!colMap) continue;

    for (const prop of COLOR_SCALE_ACCESSOR_PROPS) {
      const accessor = layer[prop];
      if (!accessor || typeof accessor !== 'object' || Array.isArray(accessor))
        continue;
      const acc = accessor as Record<string, unknown>;
      if (acc['@@function'] !== 'colorScale') continue;
      const field = acc.field;
      if (typeof field !== 'string') continue;

      const canonical = colMap.get(field.toLowerCase());
      if (canonical === field) {
        // Exact match — correct as-is.
        continue;
      }
      if (canonical !== undefined) {
        errors.push(
          `spec.layers.${i}.${prop}: colorScale field "${field}" has wrong casing — use "${canonical}"`,
        );
      } else {
        const available = [...colMap.values()].join(', ');
        errors.push(
          `spec.layers.${i}.${prop}: colorScale field "${field}" is not a column in dataset "${datasetId}". Available columns: ${available}`,
        );
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join('; '));
  }

  return config;
}
