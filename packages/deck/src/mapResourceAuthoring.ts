import {DeckJsonMapSpec} from './DeckJsonMapSpec';
import type {DeckMapConfig} from './mapConfig';
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

function mergeDatasetRegistry(
  existingDatasets: DeckMapConfig['datasets'],
  incomingDatasets: DeckMapConfig['datasets'],
): DeckMapConfig['datasets'] {
  if (!hasEntries(incomingDatasets)) return existingDatasets;
  const datasets = {...existingDatasets};
  for (const [datasetId, incomingDataset] of Object.entries(incomingDatasets)) {
    const existingDataset = existingDatasets[datasetId];
    datasets[datasetId] = existingDataset
      ? {
          ...existingDataset,
          ...incomingDataset,
          source: incomingDataset.source ?? existingDataset.source,
        }
      : incomingDataset;
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
      return;
    }

    issues.push({
      path: `spec.layers.${index}._sqlroomsBinding.dataset`,
      message:
        'must bind the layer to a config.datasets entry; layer data references and implicit bindings are not durable resource bindings',
    });
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
- Use supported Deck JSON layer classes such as GeoArrowScatterplotLayer, GeoArrowHeatmapLayer, GeoArrowPolygonLayer, GeoArrowPathLayer, GeoArrowTripsLayer, GeoArrowArcLayer, GeoArrowColumnLayer, GeoArrowH3HexagonLayer, or GeoJsonLayer.
- For table-backed datasets, also pass the same table through the tool's top-level tableName field. A selected table does not replace the required dataset source.
- transformSql must be a single SELECT and must read from __sqlrooms_source. Use source.sqlQuery only for a standalone pinned query.
- Use configMode "basic" for a straightforward single-layer map. Use "custom" only for advanced properties the basic settings cannot represent; custom mode does not relax dataset-source or layer-binding requirements.
- For a point geometry column, prefer GeoArrowScatterplotLayer with dataset.geometryColumn and _sqlroomsBinding.geometryColumn set to the exact geometry column. For longitude/latitude columns, use source.transformSql to produce WKB geometry and bind that output column.
- For updates, sparse config patches are allowed because they are merged with the existing resource. For creates, never send empty datasets or layers.
- To remove existing layers, set replaceLayers to true and send the complete desired spec.layers list. Omit it for additive sparse layer updates.
- If a map write reports an invalid resource config, repair the reported paths and retry the same direct map operation; do not replace it with a dashboard-backed map.

Minimal table-backed point map shape:
{"configMode":"basic","datasets":{"places":{"source":{"tableName":"places"},"geometryColumn":"geom","geometryEncodingHint":"wkb"}},"spec":{"layers":[{"@@type":"GeoArrowScatterplotLayer","id":"places","_sqlroomsBinding":{"dataset":"places","geometryColumn":"geom"},"getRadius":4,"radiusUnits":"pixels","pickable":true}]},"fitToData":{"dataset":"places","geometryColumn":"geom"}}`;
}
