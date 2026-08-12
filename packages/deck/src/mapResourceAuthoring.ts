import {
  binnedNumericSchemes,
  categoricalSchemes,
  continuousDivergingSchemes,
  continuousSequentialSchemes,
  formatColorSchemePromptLists,
} from '@sqlrooms/color-scales/colorSchemeNames';
import {DeckJsonMapSpec} from './DeckJsonMapSpec';
import type {DeckMapConfig, DeckMapDatasetSource} from './mapConfig';
import {
  isDeckMapSqlDatasetSource,
  isDeckMapTableDatasetSource,
} from './mapConfig';
import {hasSelectStarAsWkbCollision} from './selectStarAsWkbCollision';
import {getDeckMapSharedAiContractRules} from './mapAiSharedInstructions';

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

const BINNED_SCHEME_NAMES = new Set<string>(binnedNumericSchemes);
const SEQUENTIAL_SCHEME_NAMES = new Set<string>(continuousSequentialSchemes);
const DIVERGING_SCHEME_NAMES = new Set<string>(continuousDivergingSchemes);
const CATEGORICAL_SCHEME_NAMES = new Set<string>(categoricalSchemes);

/**
 * Returns an actionable issue when colorScale `type` and `scheme` disagree or
 * are incomplete. Quantile/quantize/threshold require ColorBrewer binned ramps;
 * continuous schemes like Viridis require type "sequential".
 */
export function getColorScaleTypeSchemeIssue(
  type: unknown,
  scheme: unknown,
): string | undefined {
  if (typeof type !== 'string' || !type.trim()) {
    return 'colorScale requires a "type" (sequential, diverging, quantize, quantile, threshold, or categorical)';
  }
  if (typeof scheme !== 'string' || !scheme.trim()) {
    return 'colorScale requires a "scheme" (exact name such as Viridis, YlOrRd, Blues, or Tableau10)';
  }
  if (type !== type.trim()) {
    return 'colorScale type must not have leading or trailing whitespace';
  }
  if (scheme !== scheme.trim()) {
    return 'colorScale scheme must not have leading or trailing whitespace';
  }

  const scaleType = type;
  const schemeName = scheme;

  const allowedForType = (allowed: Set<string>, label: string) => {
    if (allowed.has(schemeName)) return undefined;
    if (SEQUENTIAL_SCHEME_NAMES.has(schemeName)) {
      return `scheme "${schemeName}" requires type "sequential" (not "${scaleType}") — use type "sequential", or pick a ${label}`;
    }
    if (DIVERGING_SCHEME_NAMES.has(schemeName)) {
      return `scheme "${schemeName}" requires type "diverging" (not "${scaleType}") — use type "diverging", or pick a ${label}`;
    }
    if (CATEGORICAL_SCHEME_NAMES.has(schemeName)) {
      return `scheme "${schemeName}" requires type "categorical" (not "${scaleType}") — use type "categorical", or pick a ${label}`;
    }
    return `scheme "${schemeName}" is not valid for type "${scaleType}" — use a ${label}`;
  };

  switch (scaleType) {
    case 'quantile':
    case 'quantize':
    case 'threshold':
      return allowedForType(
        BINNED_SCHEME_NAMES,
        'ColorBrewer binned ramp such as YlOrRd, Blues, Greens, or RdYlBu',
      );
    case 'sequential':
      return allowedForType(
        SEQUENTIAL_SCHEME_NAMES,
        'sequential scheme such as Viridis, Plasma, Blues, or YlOrRd',
      );
    case 'diverging':
      return allowedForType(
        DIVERGING_SCHEME_NAMES,
        'diverging scheme such as RdBu, Spectral, or BrBG',
      );
    case 'categorical':
      return allowedForType(
        CATEGORICAL_SCHEME_NAMES,
        'categorical scheme such as Tableau10, Set2, or Category10',
      );
    default:
      return `colorScale type "${scaleType}" is not supported — use sequential, diverging, quantize, quantile, threshold, or categorical`;
  }
}

function getColorScaleThresholdsIssue(
  type: unknown,
  thresholds: unknown,
): string | undefined {
  if (type !== 'threshold') return undefined;
  if (
    !Array.isArray(thresholds) ||
    thresholds.length === 0 ||
    !thresholds.every(
      (value) => typeof value === 'number' && Number.isFinite(value),
    )
  ) {
    return 'colorScale type "threshold" requires a non-empty numeric "thresholds" array';
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function hasEntries(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && Object.keys(value).length > 0;
}

/**
 * True for invalid `ST_MakeLine(ST_Point(...) ORDER BY ...)` forms, including
 * nested coordinate expressions inside ST_Point. ORDER BY is only legal inside
 * LIST(...).
 */
function hasBadStMakeLinePointOrderBy(sql: string): boolean {
  const re = /\bST_MakeLine\s*\(/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(sql)) !== null) {
    let i = match.index + match[0].length;
    while (i < sql.length && /\s/.test(sql[i]!)) i += 1;
    if (/^LIST\s*\(/i.test(sql.slice(i))) continue;
    const pointMatch = sql.slice(i).match(/^ST_Point\s*\(/i);
    if (!pointMatch) continue;
    i += pointMatch[0].length;
    let depth = 1;
    while (i < sql.length && depth > 0) {
      const ch = sql[i];
      if (ch === '(') depth += 1;
      else if (ch === ')') depth -= 1;
      i += 1;
    }
    if (depth !== 0) continue;
    if (/^\s+ORDER\s+BY\b/i.test(sql.slice(i))) {
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
    if (sql && hasSelectStarAsWkbCollision(sql)) {
      issues.push({
        path: `datasets.${datasetId}.source`,
        message:
          'Do not use SELECT *, ST_AsWKB(col) AS col — DuckDB keeps the original column and the WKB alias collides, producing empty maps. Use SELECT * EXCLUDE (col), ST_AsWKB(col) AS col, or omit transformSql when the geometry column already exists.',
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
        const schemeIssue = getColorScaleTypeSchemeIssue(
          value.type,
          value.scheme,
        );
        if (schemeIssue) {
          issues.push({
            path: `spec.layers.${index}.${prop}`,
            message: schemeIssue,
          });
        }
        const thresholdsIssue = getColorScaleThresholdsIssue(
          value.type,
          value.thresholds,
        );
        if (thresholdsIssue) {
          issues.push({
            path: `spec.layers.${index}.${prop}`,
            message: thresholdsIssue,
          });
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

    if (layerType === 'GeoArrowHeatmapLayer' && 'getWeight' in layer) {
      // Basic mode has no weight-column UI; heatmaps use default uniform density.
      // Custom mode may set a numeric constant via the JSON editor, but column
      // / object accessors are still rejected (and AI should omit getWeight).
      const getWeight = layer.getWeight;
      if (config.configMode !== 'custom') {
        issues.push({
          path: `spec.layers.${index}.getWeight`,
          message:
            'omit getWeight for default density — the basic settings panel has no weight-column control; do not bind a column',
        });
      } else if (
        isPlainObject(getWeight) ||
        (typeof getWeight === 'string' && getWeight.trim().length > 0)
      ) {
        issues.push({
          path: `spec.layers.${index}.getWeight`,
          message:
            'omit getWeight for default density, or use a numeric constant — column / object accessors are not supported',
        });
      }
    }

    // Basic-mode UI only supports numeric size props (and elevation via
    // "@@=col" / scale objects). Custom mode may use deck.gl string accessors.
    // Reject strings and unsupported objects (e.g. scaleLinear on getRadius)
    // so the agent retries instead of saving broken accessors.
    if (config.configMode !== 'custom') {
      const rejectNonNumericSize = (
        prop: string,
        value: unknown,
        message: string,
      ) => {
        if (value === undefined) return;
        if (typeof value === 'number' && Number.isFinite(value)) return;
        issues.push({
          path: `spec.layers.${index}.${prop}`,
          message,
        });
      };

      if (layerType === 'GeoArrowScatterplotLayer') {
        rejectNonNumericSize(
          'getRadius',
          layer.getRadius,
          'use a positive number (e.g. 4) with radiusUnits "pixels" — string/object size accessors are not supported in basic mode',
        );
      }

      const LINE_LAYER_TYPES = new Set([
        'GeoArrowPathLayer',
        'GeoArrowArcLayer',
        'GeoArrowTripsLayer',
      ]);
      if (typeof layerType === 'string' && LINE_LAYER_TYPES.has(layerType)) {
        rejectNonNumericSize(
          'getWidth',
          layer.getWidth,
          'use a number (e.g. 2) with widthUnits "pixels" — string/object size accessors are not supported in basic mode',
        );
      }

      if (layerType === 'GeoArrowHeatmapLayer') {
        rejectNonNumericSize(
          'radiusPixels',
          layer.radiusPixels,
          'use a positive number (e.g. 30) — string/object size accessors are not supported in basic mode',
        );
      }

      if (layerType === 'GeoArrowColumnLayer') {
        rejectNonNumericSize(
          'radius',
          layer.radius,
          'use a positive number in meters (e.g. 50) — string/object size accessors are not supported in basic mode',
        );
      }

      const ELEVATION_LAYER_TYPES = new Set([
        'GeoArrowPolygonLayer',
        'GeoArrowSolidPolygonLayer',
        'GeoArrowColumnLayer',
        'GeoArrowH3HexagonLayer',
      ]);
      if (
        typeof layerType === 'string' &&
        ELEVATION_LAYER_TYPES.has(layerType) &&
        layer.getElevation !== undefined
      ) {
        const elev = layer.getElevation;
        // Basic UI supports a number, "@@=col", or a linear scale object.
        if (typeof elev === 'number' && Number.isFinite(elev)) {
          // Constant elevation (including 0 for flat) is fine.
        } else if (typeof elev === 'string') {
          const isColumnAccessor = /^@@=[A-Za-z_][\w]*$/.test(elev.trim());
          if (!isColumnAccessor) {
            issues.push({
              path: `spec.layers.${index}.getElevation`,
              message:
                'in basic mode use a number (0 for flat), a column accessor "@@=columnName", or {"@@function":"scale","field":"...","type":"linear","domain":"auto","range":[0,200]} — free-form string expressions require configMode "custom"',
            });
          }
        } else if (isPlainObject(elev)) {
          const fn = elev['@@function'];
          const field = typeof elev.field === 'string' ? elev.field.trim() : '';
          const typeOk =
            elev.type === undefined ||
            elev.type === 'linear' ||
            (typeof elev.type === 'string' && elev.type.trim() === 'linear');
          if ((fn !== 'scale' && fn !== 'scaleLinear') || !field || !typeOk) {
            issues.push({
              path: `spec.layers.${index}.getElevation`,
              message:
                'in basic mode use {"@@function":"scale","field":"...","type":"linear","domain":"auto","range":[0,200]} (or a column accessor "@@=columnName")',
            });
          }
        } else {
          issues.push({
            path: `spec.layers.${index}.getElevation`,
            message:
              'in basic mode use a number (0 for flat), a column accessor "@@=columnName", or {"@@function":"scale","field":"...","type":"linear","domain":"auto","range":[0,200]}',
          });
        }
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
        const hasHexagonBinding =
          typeof binding?.hexagonColumn === 'string' &&
          (binding.hexagonColumn as string).trim().length > 0;
        const getHexagonAccessor =
          typeof getHexagon === 'string' ? getHexagon.trim() : '';
        const hasGetHexagonAccessor = /^@@=[A-Za-z_][\w]*$/.test(
          getHexagonAccessor,
        );
        if (
          getHexagonAccessor &&
          !hasGetHexagonAccessor &&
          !hasHexagonBinding
        ) {
          issues.push({
            path: `spec.layers.${index}.getHexagon`,
            message:
              'use getHexagon as "@@=h3_column_name" (a simple column accessor) or set _sqlroomsBinding.hexagonColumn — bare names and expressions are not valid',
          });
        } else if (!hasGetHexagonAccessor && !hasHexagonBinding) {
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
        // legal inside LIST. Walk nested ST_Point(...) before checking ORDER BY.
        if (hasBadStMakeLinePointOrderBy(sql)) {
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

  if (
    typeof config.mapStyle === 'string' &&
    /^mapbox:/i.test(config.mapStyle.trim())
  ) {
    issues.push({
      path: 'mapStyle',
      message:
        'mapbox:// styles are not supported (MapLibre cannot fetch that URL scheme). Omit mapStyle to use the host basemap, or use a token-free MapLibre-compatible https:// style URL',
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
- Use supported Deck JSON layer classes such as GeoArrowScatterplotLayer, GeoArrowHeatmapLayer, GeoArrowPolygonLayer, GeoArrowSolidPolygonLayer, GeoArrowPathLayer, GeoArrowTripsLayer, GeoArrowArcLayer, GeoArrowColumnLayer, GeoArrowH3HexagonLayer, or GeoJsonLayer. Prefer typed GeoArrow* layers when geometry type is known; GeoJsonLayer is valid for table-backed WKB/GeoJSON via _sqlroomsBinding.
${getDeckMapSharedAiContractRules()}
- For table-backed datasets, also pass the same table through the tool's top-level tableName field. A selected table does not replace the required dataset source.
- transformSql must be a single SELECT and must read from __sqlrooms_source. Use source.sqlQuery only for a standalone pinned query.
- Use configMode "basic" for a straightforward single-layer map (including extruded column/polygon maps with one elevation column via "@@=col" or a scale accessor). Use "custom" only for advanced properties the basic settings cannot represent; custom mode disables the settings panel and does not relax dataset-source or layer-binding requirements.
- Prefer data-driven color when a useful varying column exists: getFillColor (or getColor/getSourceColor/getTargetColor for arcs) with {"@@function":"colorScale","field":"<column>","type":"sequential"|"quantile"|"categorical","scheme":"<name>","domain":"auto"}. Use quantile for skewed numeric, sequential for uniform, categorical for strings. Skip numeric columns where min = max (or all zeros) unless the user names that column; otherwise use flat fill. Exact scheme names (case-sensitive): ${formatColorSchemePromptLists()} — do not invent names. Viridis/Plasma/Inferno require type "sequential"; quantile/quantize schemes must be ColorBrewer ramps (YlOrRd, Blues, …).
- For updates, sparse config patches are allowed because they are merged with the existing resource. For creates, never send empty datasets or layers.
- When updating only visual properties (color scale, scheme, radius, width, elevation scale, visibility, opacity), send datasets as an empty object {} so the tool schema stays valid and merge keeps the existing dataset registry. Do not omit datasets entirely. Never re-send bare source.tableName without transformSql/sqlQuery — that overwrites geometry SQL and breaks the map. Include real dataset entries only when changing a data source.
- To remove existing layers or datasets, set replaceLayers and/or replaceDatasets to true and send the complete desired list or registry. Omit them for additive sparse updates. For layer-type switches, set replaceLayers: true with only the new layer — do not keep the old layer as visible: false.
- If a map write reports an invalid resource config, repair the reported paths and retry the same direct map operation; do not replace it with a dashboard-backed map.

Minimal table-backed point map shape:
{"configMode":"basic","datasets":{"places":{"source":{"tableName":"places"},"geometryColumn":"geom","geometryEncodingHint":"wkb"}},"spec":{"layers":[{"@@type":"GeoArrowScatterplotLayer","id":"places","_sqlroomsBinding":{"dataset":"places","geometryColumn":"geom"},"getRadius":4,"radiusUnits":"pixels","pickable":true}]},"fitToData":{"dataset":"places","geometryColumn":"geom"}}`;
}
