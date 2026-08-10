import {formatColorSchemePromptLists} from '@sqlrooms/color-scales/colorSchemeNames';
import {DeckJsonMapSpec} from './DeckJsonMapSpec';
import type {DeckMapConfig, DeckMapDatasetSource} from './mapConfig';
import {
  isDeckMapSqlDatasetSource,
  isDeckMapTableDatasetSource,
} from './mapConfig';

export type DeckMapResourceConfigIssue = {
  path: string;
  message: string;
};

export type DeckMapResourceConfigValidationOptions = {
  /** Empty resources are valid while waiting for a user-selected table. */
  allowEmpty?: boolean;
};

/** Controls how an incoming map config patch is merged with durable state. */
export type DeckMapResourceConfigMergeOptions = {
  /** Treat an incoming `spec.layers` array as the complete replacement list. */
  replaceLayers?: boolean;
  /** Treat incoming `datasets` as the complete replacement registry. */
  replaceDatasets?: boolean;
};

/** Error raised before an invalid map resource can be durably written. */
export class DeckMapResourceConfigError extends Error {
  readonly issues: DeckMapResourceConfigIssue[];

  constructor(issues: DeckMapResourceConfigIssue[]) {
    super(
      `Invalid Deck map resource config: ${issues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join('; ')}`,
    );
    this.name = 'DeckMapResourceConfigError';
    this.issues = issues;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function hasEntries(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && Object.keys(value).length > 0;
}

/**
 * True when SQL selects a geometry alias from bare `ST_Point(...) AS col`
 * without wrapping it in `ST_AsWKB(...)`. Nested ST_Point args are tolerated;
 * ST_Point used only as an argument to ST_MakeLine/LIST (no AS) is ignored.
 */
function hasBareStPointGeometryAlias(sql: string): boolean {
  const re = /\bST_Point\s*\(/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(sql)) !== null) {
    const start = match.index;
    const before = sql.slice(0, start).replace(/\s+$/, '');
    if (/\bST_AsWKB\s*\(\s*$/i.test(before)) {
      continue;
    }

    // Walk to the matching close paren so nested ST_Point args are allowed.
    let depth = 1;
    let i = start + match[0].length;
    while (i < sql.length && depth > 0) {
      const ch = sql[i];
      if (ch === '(') depth += 1;
      else if (ch === ')') depth -= 1;
      i += 1;
    }
    if (depth !== 0) continue;

    if (/^\s+AS\s+/i.test(sql.slice(i))) {
      return true;
    }
  }
  return false;
}

function mergeOptionalRecord(
  existing: unknown,
  incoming: unknown,
): Record<string, unknown> | undefined {
  if (isRecord(existing) && isRecord(incoming)) {
    return {...existing, ...incoming};
  }
  if (isRecord(incoming)) return incoming;
  return isRecord(existing) ? existing : undefined;
}

function mergeLayerPatch(existingLayer: unknown, incomingLayer: unknown) {
  if (!isRecord(existingLayer) || !isRecord(incomingLayer)) {
    return incomingLayer;
  }
  return {
    ...existingLayer,
    ...incomingLayer,
    _sqlroomsBinding: mergeOptionalRecord(
      existingLayer._sqlroomsBinding,
      incomingLayer._sqlroomsBinding,
    ),
  };
}

function mergeLayerPatches(
  existingLayers: unknown[] | undefined,
  incomingLayers: unknown[] | undefined,
) {
  if (!incomingLayers || incomingLayers.length === 0) return existingLayers;
  if (!existingLayers || existingLayers.length === 0) return incomingLayers;

  const nextLayers = [...existingLayers];
  for (const [incomingIndex, incomingLayer] of incomingLayers.entries()) {
    const incomingId = isRecord(incomingLayer)
      ? (incomingLayer.id as string | undefined)
      : undefined;
    const existingIndex = incomingId
      ? existingLayers.findIndex(
          (layer) => isRecord(layer) && layer.id === incomingId,
        )
      : incomingIndex < existingLayers.length
        ? incomingIndex
        : -1;
    if (existingIndex >= 0) {
      nextLayers[existingIndex] = mergeLayerPatch(
        existingLayers[existingIndex],
        incomingLayer,
      );
    } else {
      nextLayers.push(incomingLayer);
    }
  }
  return nextLayers;
}

function mergeSpecPatch(
  existingSpec: unknown,
  incomingSpec: unknown,
  options: DeckMapResourceConfigMergeOptions,
) {
  if (typeof incomingSpec === 'string') return incomingSpec;
  const existing = isRecord(existingSpec) ? existingSpec : undefined;
  const incoming = isRecord(incomingSpec) ? incomingSpec : undefined;
  if (!existing && !incoming) return incomingSpec ?? existingSpec;

  const existingLayers = Array.isArray(existing?.layers)
    ? existing.layers
    : undefined;
  const incomingLayers = Array.isArray(incoming?.layers)
    ? incoming.layers
    : undefined;
  const layers =
    options.replaceLayers && incomingLayers !== undefined
      ? incomingLayers
      : mergeLayerPatches(existingLayers, incomingLayers);
  return {
    ...(existing ?? {}),
    ...(incoming ?? {}),
    ...(layers ? {layers} : {}),
  };
}

/**
 * Returns true when the incoming source would strip geometry-producing SQL from
 * an existing source by replacing it with a bare `tableName`.
 *
 * Protects both:
 * - pinned `sqlQuery` sources
 * - `tableName` + non-empty `transformSql` sources
 *
 * Visual-only AI patches often re-send `{source: {tableName}}` and would
 * otherwise wipe the SQL that creates WKB/`geom` columns the layers bind to.
 */
function isSourceDowngrade(
  existingSource: DeckMapDatasetSource | undefined,
  incomingSource: DeckMapDatasetSource | undefined,
): boolean {
  if (!existingSource || !incomingSource) return false;

  const incomingIsBareTableName =
    isDeckMapTableDatasetSource(incomingSource) &&
    !(
      'transformSql' in incomingSource &&
      typeof incomingSource.transformSql === 'string' &&
      incomingSource.transformSql.trim().length > 0
    );
  if (!incomingIsBareTableName) return false;

  if (isDeckMapSqlDatasetSource(existingSource)) return true;

  return (
    isDeckMapTableDatasetSource(existingSource) &&
    typeof existingSource.transformSql === 'string' &&
    existingSource.transformSql.trim().length > 0
  );
}

function mergeDatasetRegistry(
  existingDatasets: DeckMapConfig['datasets'],
  incomingDatasets: DeckMapConfig['datasets'],
  replaceDatasets: boolean,
): DeckMapConfig['datasets'] {
  if (replaceDatasets) return incomingDatasets;
  if (!hasEntries(incomingDatasets)) return existingDatasets;
  const datasets = {...existingDatasets};
  for (const [datasetId, incomingDataset] of Object.entries(incomingDatasets)) {
    const existingDataset = existingDatasets[datasetId];
    if (!existingDataset) {
      datasets[datasetId] = incomingDataset;
      continue;
    }
    const resolvedSource = isSourceDowngrade(
      existingDataset.source,
      incomingDataset.source,
    )
      ? existingDataset.source
      : (incomingDataset.source ?? existingDataset.source);
    datasets[datasetId] = {
      ...existingDataset,
      ...incomingDataset,
      source: resolvedSource,
    };
  }
  return datasets;
}

/**
 * Merges a sparse map-tool patch with durable state. Empty dataset registries
 * and layer arrays mean "preserve" only when an existing resource is present.
 */
export function mergeDeckMapResourceConfigPatch(
  existingConfig: DeckMapConfig | undefined,
  incomingConfig: DeckMapConfig,
  options: DeckMapResourceConfigMergeOptions = {},
): DeckMapConfig {
  if (!existingConfig) return incomingConfig;
  return {
    ...existingConfig,
    ...incomingConfig,
    spec: mergeSpecPatch(existingConfig.spec, incomingConfig.spec, options),
    datasets: mergeDatasetRegistry(
      existingConfig.datasets,
      incomingConfig.datasets,
      options.replaceDatasets === true,
    ),
    mapProps: mergeOptionalRecord(
      existingConfig.mapProps,
      incomingConfig.mapProps,
    ),
    dataPolicy: mergeOptionalRecord(
      existingConfig.dataPolicy,
      incomingConfig.dataPolicy,
    ),
  } as DeckMapConfig;
}

function parseSpec(config: DeckMapConfig): {
  layers: Record<string, unknown>[];
  issues: DeckMapResourceConfigIssue[];
} {
  let spec: unknown = config.spec;
  if (typeof spec === 'string') {
    try {
      spec = JSON.parse(spec);
    } catch {
      return {
        layers: [],
        issues: [{path: 'spec', message: 'must be valid JSON'}],
      };
    }
  }

  const parsed = DeckJsonMapSpec.safeParse(spec);
  if (!parsed.success) {
    return {
      layers: [],
      issues: parsed.error.issues.map((issue) => ({
        path: ['spec', ...issue.path].join('.'),
        message: issue.message,
      })),
    };
  }

  return {
    layers: (parsed.data.layers ?? []) as Record<string, unknown>[],
    issues: [],
  };
}

const DECK_MAP_LAYER_CLASS_ALIASES: Record<string, string> = {
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

const COLOR_SCALE_ACCESSOR_PROPS = [
  'getFillColor',
  'getLineColor',
  'getColor',
  'getSourceColor',
  'getTargetColor',
] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

/**
 * Validates the post-merge invariants of a renderable, resource-native map.
 * Patch inputs may be sparse, but the durable result must have supported
 * dataset sources and dataset-backed layers.
 */
export function getDeckMapResourceConfigIssues(
  config: DeckMapConfig,
  options: DeckMapResourceConfigValidationOptions = {},
): DeckMapResourceConfigIssue[] {
  const issues: DeckMapResourceConfigIssue[] = [];
  const datasetEntries = Object.entries(config.datasets);
  const datasetIds = datasetEntries.map(([datasetId]) => datasetId);
  const datasetIdSet = new Set(datasetIds);
  const parsedSpec = parseSpec(config);
  issues.push(...parsedSpec.issues);

  const isEmpty = datasetEntries.length === 0 && parsedSpec.layers.length === 0;
  if (isEmpty) {
    return options.allowEmpty
      ? issues
      : [
          ...issues,
          {
            path: 'datasets',
            message: 'must contain at least one dataset for a map write',
          },
          {
            path: 'spec.layers',
            message: 'must contain at least one dataset-backed layer',
          },
        ];
  }

  if (datasetEntries.length === 0) {
    issues.push({
      path: 'datasets',
      message: 'must contain at least one dataset',
    });
  }

  for (const [datasetId, dataset] of datasetEntries) {
    const source = dataset.source;
    const hasSqlSource =
      isDeckMapSqlDatasetSource(source) && source.sqlQuery.trim().length > 0;
    const hasTableSource =
      isDeckMapTableDatasetSource(source) && source.tableName.trim().length > 0;
    if (!hasSqlSource && !hasTableSource) {
      const legacySql = (dataset as unknown as Record<string, unknown>).sql;
      issues.push({
        path: `datasets.${datasetId}.source`,
        message:
          typeof legacySql === 'string'
            ? 'must define source.tableName or source.sqlQuery; top-level sql is not supported'
            : 'must define source.tableName or source.sqlQuery',
      });
    }

    const sqlParts = [
      isDeckMapTableDatasetSource(source) ? source.transformSql : undefined,
      isDeckMapSqlDatasetSource(source) ? source.sqlQuery : undefined,
    ].filter(
      (part): part is string =>
        typeof part === 'string' && part.trim().length > 0,
    );
    const sql = sqlParts.join('\n');
    if (sql && hasBareStPointGeometryAlias(sql)) {
      issues.push({
        path: `datasets.${datasetId}.source`,
        message:
          'Geometry columns must be produced with ST_AsWKB(ST_Point(...)) AS col — bare ST_Point(...) AS col returns an internal DuckDB geometry type that cannot be decoded. Wrap ST_Point with ST_AsWKB.',
      });
    }
  }

  if (parsedSpec.layers.length === 0) {
    issues.push({
      path: 'spec.layers',
      message: 'must contain at least one dataset-backed layer',
    });
  }

  parsedSpec.layers.forEach((layer, index) => {
    const layerType = layer['@@type'];
    if (typeof layerType !== 'string' || layerType.trim().length === 0) {
      issues.push({
        path: `spec.layers.${index}.@@type`,
        message: 'must name a Deck JSON layer class',
      });
    } else {
      const aliased = DECK_MAP_LAYER_CLASS_ALIASES[layerType];
      if (aliased) {
        issues.push({
          path: `spec.layers.${index}.@@type`,
          message: `use "${aliased}" — plain "${layerType}" is not a registered Deck JSON layer class`,
        });
      }
    }

    for (const prop of COLOR_SCALE_ACCESSOR_PROPS) {
      const value = layer[prop];
      if (!isPlainObject(value)) continue;

      if (
        value['@@type'] === 'ColorScale' &&
        value['@@function'] !== 'colorScale'
      ) {
        issues.push({
          path: `spec.layers.${index}.${prop}`,
          message:
            'use {"@@function":"colorScale","field":"<column>","type":"...","scheme":"...","domain":"auto"} — {"@@type":"ColorScale","column":"..."} is not valid colorScale syntax',
        });
        continue;
      }

      if (value['@@function'] === 'colorScale') {
        if (typeof value.field !== 'string' || !value.field.trim()) {
          if (typeof value.column === 'string' && value.column.trim()) {
            issues.push({
              path: `spec.layers.${index}.${prop}`,
              message:
                'colorScale uses "field" for the column name, not "column" — rename column → field',
            });
          } else {
            issues.push({
              path: `spec.layers.${index}.${prop}`,
              message:
                'colorScale requires a non-empty string "field" with the exact column name',
            });
          }
        }
      }
    }

    const binding =
      layer._sqlroomsBinding && typeof layer._sqlroomsBinding === 'object'
        ? (layer._sqlroomsBinding as Record<string, unknown>)
        : undefined;
    const boundDataset =
      typeof binding?.dataset === 'string' && binding.dataset.trim()
        ? binding.dataset
        : undefined;

    if (boundDataset) {
      if (!datasetIdSet.has(boundDataset)) {
        issues.push({
          path: `spec.layers.${index}._sqlroomsBinding.dataset`,
          message: `references unknown dataset "${boundDataset}"`,
        });
      }
    } else {
      issues.push({
        path: `spec.layers.${index}._sqlroomsBinding.dataset`,
        message:
          'must bind the layer to a config.datasets entry; layer data references and implicit bindings are not durable resource bindings',
      });
    }

    if (layerType === 'GeoArrowHeatmapLayer') {
      if ('colorRange' in layer) {
        issues.push({
          path: `spec.layers.${index}.colorRange`,
          message:
            'omit colorRange on GeoArrowHeatmapLayer — the UI scheme selector owns the color ramp; hand-crafted RGB arrays are not supported',
        });
      }
      const getWeight = layer.getWeight;
      if (isPlainObject(getWeight)) {
        issues.push({
          path: `spec.layers.${index}.getWeight`,
          message:
            'use a deck.gl attribute string "@@=ColumnName" (or a constant number) — object accessors like {"@@function":"...","field":"..."} are not valid for getWeight',
        });
      }
    }

    if (layerType === 'GeoArrowH3HexagonLayer') {
      const getHexagon = layer.getHexagon;
      if (isPlainObject(getHexagon)) {
        issues.push({
          path: `spec.layers.${index}.getHexagon`,
          message:
            'use getHexagon as a deck.gl attribute string "@@=h3_column_name" (or set _sqlroomsBinding.hexagonColumn) — object accessors like {"@@function":"...","column":"..."} are not valid',
        });
      } else {
        const hasGetHexagon =
          typeof getHexagon === 'string' && getHexagon.trim().length > 0;
        const hasHexagonBinding =
          typeof binding?.hexagonColumn === 'string' &&
          (binding.hexagonColumn as string).trim().length > 0;
        if (!hasGetHexagon && !hasHexagonBinding) {
          issues.push({
            path: `spec.layers.${index}.getHexagon`,
            message:
              'GeoArrowH3HexagonLayer requires getHexagon (e.g. "@@=h3_column_name") or _sqlroomsBinding.hexagonColumn set to the H3 index column',
          });
        }
      }
    }

    if (layerType === 'GeoArrowArcLayer') {
      if (layer.getSourcePosition !== undefined) {
        issues.push({
          path: `spec.layers.${index}.getSourcePosition`,
          message:
            'do not set getSourcePosition — bind the source geometry via _sqlroomsBinding.sourceGeometryColumn only',
        });
      }
      if (layer.getTargetPosition !== undefined) {
        issues.push({
          path: `spec.layers.${index}.getTargetPosition`,
          message:
            'do not set getTargetPosition — bind the target geometry via _sqlroomsBinding.targetGeometryColumn only',
        });
      }
      const hasSource =
        typeof binding?.sourceGeometryColumn === 'string' &&
        (binding.sourceGeometryColumn as string).trim().length > 0;
      const hasTarget =
        typeof binding?.targetGeometryColumn === 'string' &&
        (binding.targetGeometryColumn as string).trim().length > 0;
      if (!hasSource) {
        issues.push({
          path: `spec.layers.${index}._sqlroomsBinding.sourceGeometryColumn`,
          message:
            'GeoArrowArcLayer requires _sqlroomsBinding.sourceGeometryColumn set to the source geometry column name',
        });
      }
      if (!hasTarget) {
        issues.push({
          path: `spec.layers.${index}._sqlroomsBinding.targetGeometryColumn`,
          message:
            'GeoArrowArcLayer requires _sqlroomsBinding.targetGeometryColumn set to the target geometry column name',
        });
      }
    }

    if (layerType === 'GeoArrowTripsLayer') {
      const hasTimestampColumn =
        typeof binding?.timestampColumn === 'string' &&
        (binding.timestampColumn as string).trim().length > 0;
      if (!hasTimestampColumn) {
        issues.push({
          path: `spec.layers.${index}._sqlroomsBinding.timestampColumn`,
          message:
            'GeoArrowTripsLayer requires _sqlroomsBinding.timestampColumn set to the timestamps list column, e.g. "timestamps"',
        });
      }

      // Waypoint aggregation via LIST(...)/ST_MakeLine must GROUP BY trip id.
      // Without GROUP BY, all waypoints collapse into one path or the query fails.
      if (boundDataset && config.datasets[boundDataset]) {
        const source = config.datasets[boundDataset]?.source as
          | {transformSql?: string; sqlQuery?: string}
          | undefined;
        const sql = `${source?.transformSql ?? ''} ${source?.sqlQuery ?? ''}`;
        // ST_MakeLine(ST_Point(...) ORDER BY ...) is invalid: ORDER BY is only
        // legal inside LIST. Use a pattern that tolerates nested ST_Point(...).
        const hasBadMakeLineOrderBy =
          /\bST_MakeLine\s*\(\s*(?!LIST\s*\()ST_Point\s*\([^)]*\)\s+ORDER\s+BY\b/i.test(
            sql,
          );
        if (hasBadMakeLineOrderBy) {
          issues.push({
            path: `datasets.${boundDataset}.source`,
            message:
              'ST_MakeLine is a scalar that takes a LIST of points. Use ST_MakeLine(LIST(ST_Point(lon, lat) ORDER BY waypoint_order)) — never ST_MakeLine(ST_Point(...) ORDER BY ...). ORDER BY is only valid inside LIST.',
          });
        }
        const usesListAgg =
          /\bST_MakeLine\s*\(\s*LIST\s*\(/i.test(sql) ||
          /\bLIST\s*\([^)]*ORDER\s+BY/i.test(sql);
        const hasGroupBy = /\bGROUP\s+BY\b/i.test(sql);
        if (usesListAgg && !hasGroupBy) {
          issues.push({
            path: `datasets.${boundDataset}.source`,
            message:
              'GeoArrowTripsLayer waypoint aggregation using LIST(...)/ST_MakeLine must include GROUP BY the trip/path/route id column so each trip becomes one linestring. Without GROUP BY, waypoints are not split per trip.',
          });
        }
      }
    }
  });

  const fitDataset = config.fitToData?.dataset;
  if (fitDataset && !datasetIdSet.has(fitDataset)) {
    issues.push({
      path: 'fitToData.dataset',
      message: `references unknown dataset "${fitDataset}"`,
    });
  }

  return issues;
}

/** Rejects invalid durable map writes after sparse patches have been merged. */
export function assertDeckMapResourceConfig(config: DeckMapConfig): void {
  const issues = getDeckMapResourceConfigIssues(config);
  if (issues.length > 0) throw new DeckMapResourceConfigError(issues);
}

/**
 * Returns the package-owned authoring contract for hosts with direct worksheet
 * map capability. Host adapters opt into it; they do not maintain prompt copies.
 */
export function getDeckMapResourceAiInstructions(): string {
  return `## Direct worksheet Deck map resources

When authoring a worksheet map config, use the resource-native Deck JSON contract:
- A new map must contain at least one config.datasets entry and at least one spec.layers entry.
- Every dataset must define source.tableName, source.tableName plus source.transformSql, or source.sqlQuery. Never put sql directly on the dataset object.
- Bind every layer to a dataset with _sqlroomsBinding.dataset. Never use data: "@@#datasetId" or an implicit single-dataset binding as a durable resource binding.
- Use supported Deck JSON layer classes such as GeoArrowScatterplotLayer, GeoArrowHeatmapLayer, GeoArrowPolygonLayer, GeoArrowSolidPolygonLayer, GeoArrowPathLayer, GeoArrowTripsLayer, GeoArrowArcLayer, GeoArrowColumnLayer, GeoArrowH3HexagonLayer, or GeoJsonLayer.
- For GeoArrowH3HexagonLayer, set getHexagon to a string accessor like "@@=hex_id" — not an object or columnAccessor (those render nothing).
- For GeoArrowArcLayer, bind WKB columns only via _sqlroomsBinding.sourceGeometryColumn and targetGeometryColumn (do not set getSourcePosition/getTargetPosition). transformSql must use ST_AsWKB(ST_Point(...)) for those columns; set geometryEncodingHint to "wkb".
- For animated trips use GeoArrowTripsLayer — never ArcLayer (arcs are static OD links). One output row per trip: LineString geom + timestamps. Waypoint tables: ST_MakeLine(LIST(ST_Point(...) ORDER BY col)) GROUP BY trip id, keep attrs with ANY_VALUE(col). OD-pair tables: synthesize a 2-point LineString + timestamps (no GROUP BY). Set geometryColumn "geom", geometryEncodingHint "wkb", and _sqlroomsBinding.timestampColumn "timestamps".
- For table-backed datasets, also pass the same table through the tool's top-level tableName field. A selected table does not replace the required dataset source.
- transformSql must be a single SELECT and must read from __sqlrooms_source. Use source.sqlQuery only for a standalone pinned query.
- Use configMode "basic" for a straightforward single-layer map. Use "custom" only for advanced properties the basic settings cannot represent; custom mode does not relax dataset-source or layer-binding requirements.
- For a point geometry column, prefer GeoArrowScatterplotLayer with dataset.geometryColumn and _sqlroomsBinding.geometryColumn set to the exact geometry column. For longitude/latitude columns, use source.transformSql to produce WKB geometry and bind that output column.
- Prefer data-driven color when a useful column exists: getFillColor (or getColor/getSourceColor/getTargetColor for arcs) with {"@@function":"colorScale","field":"<column>","type":"sequential"|"quantile"|"categorical","scheme":"<name>","domain":"auto"}. Use quantile for skewed numeric, sequential for uniform, categorical for strings. Exact scheme names (case-sensitive): ${formatColorSchemePromptLists()} — do not invent names.
- For updates, sparse config patches are allowed because they are merged with the existing resource. For creates, never send empty datasets or layers.
- When updating only visual properties (color scale, scheme, radius, width, elevation scale, visibility, opacity), omit the datasets field. Re-sending bare source.tableName without transformSql/sqlQuery overwrites geometry SQL and breaks the map; include datasets only when changing a data source.
- To remove existing layers or datasets, set replaceLayers and/or replaceDatasets to true and send the complete desired list or registry. Omit them for additive sparse updates. For layer-type switches, set replaceLayers: true with only the new layer — do not keep the old layer as visible: false.
- If a map write reports an invalid resource config, repair the reported paths and retry the same direct map operation; do not replace it with a dashboard-backed map.

Minimal table-backed point map shape:
{"configMode":"basic","datasets":{"places":{"source":{"tableName":"places"},"geometryColumn":"geom","geometryEncodingHint":"wkb"}},"spec":{"layers":[{"@@type":"GeoArrowScatterplotLayer","id":"places","_sqlroomsBinding":{"dataset":"places","geometryColumn":"geom"},"getRadius":4,"radiusUnits":"pixels","pickable":true}]},"fitToData":{"dataset":"places","geometryColumn":"geom"}}`;
}
