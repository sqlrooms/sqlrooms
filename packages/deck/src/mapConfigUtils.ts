import {
  getRawSqlTableReference,
  makeQualifiedTableName,
  quoteParsedRawSqlTableReference,
  type DataTable,
  type RawSqlTableReference,
} from '@sqlrooms/duckdb';
import {
  createDeckMapDashboardPanelConfig,
  isDeckMapTableDatasetSource,
  type DeckMapDashboardPanelConfig,
  type DeckMapConfig,
  type DeckMapTableHistorySnapshot,
} from './mapConfig';
import {DECK_TABLE_DATASET_SOURCE_RELATION} from './datasets/tableDatasetSql';
import type {GeometryEncodingHint} from './prepare/types';
import {getDefaultDeckMapStyle} from './mapStyles';
import {isDeckMapGeneratedColumn} from './useDeckMapDatasetSchema';

const LONGITUDE_COLUMN_NAMES = ['longitude', 'lon', 'lng', 'long', 'x'];
const LATITUDE_COLUMN_NAMES = ['latitude', 'lat', 'y'];
const GEOMETRY_COLUMN_NAMES = ['geometry', 'geom'];
const DEFAULT_GEOMETRY_COLUMN = '__sqlrooms_geom';
const DEFAULT_FILL_COLOR = [56, 189, 248, 180] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function updateDeckMapGeometryColumnBindings(
  config: DeckMapDashboardPanelConfig,
  datasetId: string,
  geometryColumn: string | undefined,
) {
  if (!geometryColumn || !isRecord(config.spec)) return config;
  const layers = config.spec.layers;
  if (!Array.isArray(layers)) return config;

  let changed = false;
  const nextLayers = layers.map((layer) => {
    if (!isRecord(layer) || !isRecord(layer._sqlroomsBinding)) return layer;
    const binding = layer._sqlroomsBinding;
    if (
      binding.dataset !== datasetId ||
      typeof binding.geometryColumn !== 'string'
    ) {
      return layer;
    }
    changed = true;
    return {
      ...layer,
      _sqlroomsBinding: {...binding, geometryColumn},
    };
  });

  return changed
    ? {...config, spec: {...config.spec, layers: nextLayers}}
    : config;
}

export type DeckMapConfigColumn = {name: string; type?: string};
export type DeckMapTableReference =
  | string
  | {
      database?: string;
      schema?: string;
      table?: string;
    };
export type DeckMapFillColor =
  | [number, number, number]
  | [number, number, number, number];

function findColumnByName(
  columns: DeckMapConfigColumn[],
  candidates: string[],
) {
  const candidateSet = new Set(candidates);
  return columns.find((column) => candidateSet.has(column.name.toLowerCase()))
    ?.name;
}

function resolveDeckMapCoordinateColumnNames(options: {
  columns: DeckMapConfigColumn[];
  longitudeColumn?: string;
  latitudeColumn?: string;
}) {
  const longitudeColumn =
    options.longitudeColumn ||
    findColumnByName(options.columns, LONGITUDE_COLUMN_NAMES);
  const latitudeColumn =
    options.latitudeColumn ||
    findColumnByName(options.columns, LATITUDE_COLUMN_NAMES);
  return longitudeColumn && latitudeColumn
    ? {longitudeColumn, latitudeColumn}
    : null;
}

export function findDeckMapLongitudeLatitudeColumns(
  columns?: DeckMapConfigColumn[],
) {
  if (!columns) return null;
  return resolveDeckMapCoordinateColumnNames({columns});
}

export function findLongitudeLatitudeColumns(table?: DataTable) {
  if (!table) return null;
  return findDeckMapLongitudeLatitudeColumns(table.columns);
}

function inferGeometryEncodingHint(
  column: DeckMapConfigColumn,
): GeometryEncodingHint | undefined {
  const type = column.type?.toLowerCase();
  if (!type) return undefined;
  if (
    type.includes('wkb') ||
    type.includes('blob') ||
    type.includes('binary')
  ) {
    return 'wkb';
  }
  if (
    type.includes('wkt') ||
    type.includes('varchar') ||
    type.includes('text')
  ) {
    return 'wkt';
  }
  // Native DuckDB GEOMETRY is not an encoding hint — the dataset pipeline
  // projects it through ST_AsWKB via DESCRIBE + SELECT * REPLACE.
  return undefined;
}

export function findDeckMapGeometryColumn(columns?: DeckMapConfigColumn[]) {
  if (!columns) return null;

  const namedGeometryColumn = findColumnByName(columns, GEOMETRY_COLUMN_NAMES);
  const geometryColumn =
    (namedGeometryColumn
      ? columns.find((column) => column.name === namedGeometryColumn)
      : undefined) ??
    columns.find((column) => {
      const type = column.type?.toLowerCase() ?? '';
      return type.includes('geometry') || type.includes('geoarrow');
    });

  if (!geometryColumn) return null;
  return {
    geometryColumn: geometryColumn.name,
    geometryEncodingHint: inferGeometryEncodingHint(geometryColumn),
  };
}

export function findGeometryColumn(table?: DataTable) {
  if (!table) return null;
  return findDeckMapGeometryColumn(table.columns);
}

export function quoteDeckMapSqlIdentifier(identifier: string) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

export function quoteDeckMapSqlTableReference(
  tableReference: DeckMapTableReference,
): RawSqlTableReference {
  if (typeof tableReference === 'string') {
    const rawSqlTableReference =
      quoteParsedRawSqlTableReference(tableReference);
    if (!rawSqlTableReference) {
      throw new Error(`Invalid deck map table reference "${tableReference}".`);
    }
    return rawSqlTableReference;
  }
  if (!tableReference.table) {
    throw new Error('Deck map table reference object requires a table name.');
  }
  return getRawSqlTableReference(
    makeQualifiedTableName({
      database: tableReference.database,
      schema: tableReference.schema,
      table: tableReference.table,
    }),
  );
}

function ensureDeckMapColumnExists(
  columns: DeckMapConfigColumn[],
  columnName: string,
  role: string,
) {
  if (!columns.some((column) => column.name === columnName)) {
    throw new Error(
      `Unknown ${role} column "${columnName}". Available columns: ${columns
        .map((column) => column.name)
        .join(', ')}.`,
    );
  }
}

function resolveDeckMapCoordinateColumns(options: {
  columns: DeckMapConfigColumn[];
  longitudeColumn?: string;
  latitudeColumn?: string;
}) {
  const coordinates =
    options.longitudeColumn && options.latitudeColumn
      ? {
          longitudeColumn: options.longitudeColumn,
          latitudeColumn: options.latitudeColumn,
        }
      : findDeckMapLongitudeLatitudeColumns(options.columns);

  if (!coordinates) {
    throw new Error(
      'Could not find longitude/latitude columns. Pass longitudeColumn and latitudeColumn explicitly, or provide geometryColumn.',
    );
  }

  ensureDeckMapColumnExists(
    options.columns,
    coordinates.longitudeColumn,
    'longitude',
  );
  ensureDeckMapColumnExists(
    options.columns,
    coordinates.latitudeColumn,
    'latitude',
  );
  return coordinates;
}

function createDeckMapPointSourceSql(options: {
  sourceSqlQuery?: string;
  tableReference: DeckMapTableReference;
  longitudeColumn: string;
  latitudeColumn: string;
  geometryColumn: string;
}) {
  const quotedLongitude = quoteDeckMapSqlIdentifier(options.longitudeColumn);
  const quotedLatitude = quoteDeckMapSqlIdentifier(options.latitudeColumn);
  const cleanedSourceSqlQuery = options.sourceSqlQuery
    ?.trim()
    .replace(/(?:\s*;+\s*)+$/, '');
  const baseSource = cleanedSourceSqlQuery
    ? `(${cleanedSourceSqlQuery}) AS "__sqlrooms_dashboard_map_source"`
    : quoteDeckMapSqlTableReference(options.tableReference);

  return [
    `SELECT *, ST_AsWKB(ST_Point(${quotedLongitude}, ${quotedLatitude})) AS ${quoteDeckMapSqlIdentifier(options.geometryColumn)}`,
    `FROM ${baseSource}`,
    `WHERE ${quotedLongitude} IS NOT NULL AND ${quotedLatitude} IS NOT NULL`,
  ].join(' ');
}

/**
 * Builds the standard lon/lat → WKB point transform SQL used by Deck map
 * datasets that follow the selected table via {@link DECK_TABLE_DATASET_SOURCE_RELATION}.
 */
export function createDeckMapPointTransformSql(options: {
  longitudeColumn: string;
  latitudeColumn: string;
  geometryColumn: string;
}) {
  const quotedLongitude = quoteDeckMapSqlIdentifier(options.longitudeColumn);
  const quotedLatitude = quoteDeckMapSqlIdentifier(options.latitudeColumn);

  return [
    `SELECT *, ST_AsWKB(ST_Point(${quotedLongitude}, ${quotedLatitude})) AS ${quoteDeckMapSqlIdentifier(options.geometryColumn)}`,
    `FROM ${DECK_TABLE_DATASET_SOURCE_RELATION}`,
    `WHERE ${quotedLongitude} IS NOT NULL AND ${quotedLatitude} IS NOT NULL`,
  ].join(' ');
}

/**
 * Builds WKB point SQL from a source geometry column via `ST_Centroid`.
 * Point geometries are unchanged; polygons/lines become representative points
 * so scatterplot/heatmap/column layers can bind the same field.
 */
export function createDeckMapCentroidTransformSql(options: {
  geometryColumn: string;
}) {
  const quotedGeometry = quoteDeckMapSqlIdentifier(options.geometryColumn);
  return [
    `SELECT * REPLACE (ST_AsWKB(ST_Centroid(${quotedGeometry})) AS ${quotedGeometry})`,
    `FROM ${DECK_TABLE_DATASET_SOURCE_RELATION}`,
  ].join(' ');
}

/**
 * Reads the source geometry column from canonical centroid point transform SQL.
 */
export function parseDeckMapCentroidTransformSql(
  transformSql: string,
): {geometryColumn: string} | undefined {
  const match = transformSql.match(
    /ST_AsWKB\s*\(\s*ST_Centroid\s*\(\s*"?([^"\s,]+)"?\s*\)\s*\)\s*AS\s+"?([^\s",]+)"?/i,
  );
  if (!match?.[1] || !match[2] || match[1] !== match[2]) return undefined;
  return {geometryColumn: match[1]};
}

/**
 * Reads longitude/latitude/geometry aliases from canonical point transform SQL.
 */
export function parseDeckMapPointTransformSql(transformSql: string):
  | {
      longitudeColumn: string;
      latitudeColumn: string;
      geometryColumn: string;
    }
  | undefined {
  const match = transformSql.match(
    /ST_AsWKB\s*\(\s*ST_Point\s*\(\s*"?([^"\s,]+)"?\s*,\s*"?([^"\s,]+)"?\s*\)\s*\)\s*AS\s+"?([^\s",]+)"?/i,
  );
  if (!match?.[1] || !match[2] || !match[3]) return undefined;
  return {
    longitudeColumn: match[1],
    latitudeColumn: match[2],
    geometryColumn: match[3],
  };
}

/**
 * Reads origin/destination lon/lat and geometry aliases from canonical arc
 * transform SQL.
 */
export function parseDeckMapArcTransformSql(transformSql: string):
  | {
      sourceLongitudeColumn: string;
      sourceLatitudeColumn: string;
      targetLongitudeColumn: string;
      targetLatitudeColumn: string;
      sourceGeometryColumn: string;
      targetGeometryColumn: string;
    }
  | undefined {
  const matches = [
    ...transformSql.matchAll(
      /ST_AsWKB\s*\(\s*ST_Point\s*\(\s*"?([^"\s,]+)"?\s*,\s*"?([^"\s,]+)"?\s*\)\s*\)\s*AS\s+"?([^\s",]+)"?/gi,
    ),
  ];
  const source = matches[0];
  const target = matches[1];
  if (
    !source?.[1] ||
    !source[2] ||
    !source[3] ||
    !target?.[1] ||
    !target[2] ||
    !target[3]
  ) {
    return undefined;
  }
  return {
    sourceLongitudeColumn: source[1],
    sourceLatitudeColumn: source[2],
    sourceGeometryColumn: source[3],
    targetLongitudeColumn: target[1],
    targetLatitudeColumn: target[2],
    targetGeometryColumn: target[3],
  };
}

/**
 * Builds the standard origin/destination lon/lat → WKB arc transform SQL.
 */
export function createDeckMapArcTransformSql(options: {
  sourceLongitudeColumn: string;
  sourceLatitudeColumn: string;
  targetLongitudeColumn: string;
  targetLatitudeColumn: string;
  sourceGeometryColumn: string;
  targetGeometryColumn: string;
}) {
  const quotedSourceLongitude = quoteDeckMapSqlIdentifier(
    options.sourceLongitudeColumn,
  );
  const quotedSourceLatitude = quoteDeckMapSqlIdentifier(
    options.sourceLatitudeColumn,
  );
  const quotedTargetLongitude = quoteDeckMapSqlIdentifier(
    options.targetLongitudeColumn,
  );
  const quotedTargetLatitude = quoteDeckMapSqlIdentifier(
    options.targetLatitudeColumn,
  );

  return [
    `SELECT *, ST_AsWKB(ST_Point(${quotedSourceLongitude}, ${quotedSourceLatitude})) AS ${quoteDeckMapSqlIdentifier(options.sourceGeometryColumn)}, ST_AsWKB(ST_Point(${quotedTargetLongitude}, ${quotedTargetLatitude})) AS ${quoteDeckMapSqlIdentifier(options.targetGeometryColumn)}`,
    `FROM ${DECK_TABLE_DATASET_SOURCE_RELATION}`,
    `WHERE ${quotedSourceLongitude} IS NOT NULL AND ${quotedSourceLatitude} IS NOT NULL AND ${quotedTargetLongitude} IS NOT NULL AND ${quotedTargetLatitude} IS NOT NULL`,
  ].join(' ');
}

const DECK_MAP_POINT_LAYER_TYPES = new Set([
  'GeoArrowScatterplotLayer',
  'GeoArrowHeatmapLayer',
  'GeoArrowColumnLayer',
  'GeoJsonLayer',
]);

/** Structured provenance for a table-backed longitude/latitude point dataset. */
export type DeckMapPointBinding = {
  dataset: string;
  longitudeColumn: string;
  latitudeColumn: string;
  geometryColumn?: string;
};

function isDeckMapConfigRecord(
  value: unknown,
): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function deckMapLayerTargetsDataset(options: {
  layer: Record<string, unknown>;
  datasetId: string;
  datasetIds: string[];
}) {
  const binding = isDeckMapConfigRecord(options.layer._sqlroomsBinding)
    ? options.layer._sqlroomsBinding
    : undefined;
  const boundDataset = binding?.dataset;

  if (typeof boundDataset === 'string') {
    return boundDataset === options.datasetId;
  }

  return options.datasetIds.length === 1 && options.layer.data === undefined;
}

/**
 * True when retained layers need dataset columns that
 * {@link createDeckMapConfigForTable} cannot reconstruct (arc endpoints, H3
 * indexes, trip timestamps, or a non-canonical transform such as ST_MakeLine).
 * Regenerating the dataset while keeping those layers would drop columns the
 * layers still bind to.
 */
function deckMapDatasetHasCustomTransform(
  config: DeckMapDashboardPanelConfig,
  datasetId: string,
) {
  const dataset = config.datasets?.[datasetId];
  const transformSql =
    dataset && isDeckMapTableDatasetSource(dataset.source)
      ? dataset.source.transformSql?.trim()
      : undefined;
  if (
    transformSql &&
    !isCanonicalDeckMapPointTransformSql(transformSql) &&
    !parseDeckMapCentroidTransformSql(transformSql)
  ) {
    return true;
  }

  if (
    !isDeckMapConfigRecord(config.spec) ||
    !Array.isArray(config.spec.layers)
  ) {
    return false;
  }
  const datasetIds = Object.keys(config.datasets ?? {});
  return config.spec.layers.some((layer) => {
    if (
      !isDeckMapConfigRecord(layer) ||
      !isDeckMapConfigRecord(layer._sqlroomsBinding)
    ) {
      return false;
    }
    if (
      !deckMapLayerTargetsDataset({
        layer,
        datasetId,
        datasetIds,
      })
    ) {
      return false;
    }
    const binding = layer._sqlroomsBinding;
    return (
      typeof binding.sourceGeometryColumn === 'string' ||
      typeof binding.targetGeometryColumn === 'string' ||
      typeof binding.hexagonColumn === 'string' ||
      typeof binding.timestampColumn === 'string'
    );
  });
}

function isCanonicalDeckMapPointTransformSql(transformSql: string) {
  return Boolean(
    parseDeckMapPointTransformSql(transformSql) &&
    !parseDeckMapArcTransformSql(transformSql) &&
    !/ST_MakeLine/i.test(transformSql),
  );
}

function extractDeckMapTransformInputColumns(transformSql: string): string[] {
  const arc = parseDeckMapArcTransformSql(transformSql);
  if (arc) {
    return uniqueDeckMapColumnNames([
      arc.sourceLongitudeColumn,
      arc.sourceLatitudeColumn,
      arc.targetLongitudeColumn,
      arc.targetLatitudeColumn,
    ]);
  }
  const centroid = parseDeckMapCentroidTransformSql(transformSql);
  if (centroid) {
    return uniqueDeckMapColumnNames([centroid.geometryColumn]);
  }
  if (!/ST_MakeLine/i.test(transformSql)) {
    const point = parseDeckMapPointTransformSql(transformSql);
    if (point) {
      return uniqueDeckMapColumnNames([
        point.longitudeColumn,
        point.latitudeColumn,
      ]);
    }
  }

  const aliases = new Set(
    [...transformSql.matchAll(/\bAS\s+"([^"]+)"|\bAS\s+([A-Za-z_][\w$]*)/gi)]
      .map((match) => match[1] ?? match[2])
      .filter((name): name is string => Boolean(name)),
  );
  const columns: string[] = [];
  for (const match of transformSql.matchAll(
    /ST_Point\s*\(\s*"?([^"\s,]+)"?\s*,\s*"?([^"\s,]+)"?/gi,
  )) {
    if (match[1]) columns.push(match[1]);
    if (match[2]) columns.push(match[2]);
  }
  for (const match of transformSql.matchAll(/"([^"]+)"/g)) {
    const name = match[1];
    if (
      !name ||
      name === DECK_TABLE_DATASET_SOURCE_RELATION ||
      aliases.has(name)
    ) {
      continue;
    }
    columns.push(name);
  }
  return uniqueDeckMapColumnNames(columns);
}

function uniqueDeckMapColumnNames(names: string[]) {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const name of names) {
    const trimmed = name.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    unique.push(trimmed);
  }
  return unique;
}

const DECK_MAP_BINDING_COORDINATE_KEYS = [
  'longitudeColumn',
  'latitudeColumn',
  'sourceLatitudeColumn',
  'sourceLongitudeColumn',
  'targetLatitudeColumn',
  'targetLongitudeColumn',
] as const;

const DECK_MAP_BINDING_GEOMETRY_KEYS = [
  'geometryColumn',
  'sourceGeometryColumn',
  'targetGeometryColumn',
  'hexagonColumn',
  'timestampColumn',
] as const;

function getDeckMapRequiredSourceColumns(
  config: DeckMapDashboardPanelConfig,
  datasetId: string,
): string[] {
  const required: string[] = [];
  const dataset = config.datasets?.[datasetId];
  const transformSql =
    dataset && isDeckMapTableDatasetSource(dataset.source)
      ? dataset.source.transformSql?.trim()
      : undefined;
  if (transformSql) {
    required.push(...extractDeckMapTransformInputColumns(transformSql));
  }

  if (isDeckMapConfigRecord(config.spec) && Array.isArray(config.spec.layers)) {
    const datasetIds = Object.keys(config.datasets ?? {});
    for (const layer of config.spec.layers) {
      if (
        !isDeckMapConfigRecord(layer) ||
        !isDeckMapConfigRecord(layer._sqlroomsBinding) ||
        !deckMapLayerTargetsDataset({layer, datasetId, datasetIds})
      ) {
        continue;
      }
      const binding = layer._sqlroomsBinding;
      for (const key of DECK_MAP_BINDING_COORDINATE_KEYS) {
        const name = binding[key];
        if (typeof name === 'string') required.push(name);
      }
      for (const key of DECK_MAP_BINDING_GEOMETRY_KEYS) {
        const name = binding[key];
        if (typeof name !== 'string') continue;
        if (transformSql && isDeckMapGeneratedColumn(name)) continue;
        required.push(name);
      }
    }
  }

  const fitToData = config.fitToData;
  if (fitToData?.dataset === datasetId) {
    if (fitToData.longitudeColumn) required.push(fitToData.longitudeColumn);
    if (fitToData.latitudeColumn) required.push(fitToData.latitudeColumn);
  }

  return uniqueDeckMapColumnNames(required);
}

function deckMapSourceCompatibleWithTable(
  config: DeckMapDashboardPanelConfig,
  datasetId: string,
  table: DataTable,
) {
  const required = getDeckMapRequiredSourceColumns(config, datasetId);
  const transformSql =
    config.datasets?.[datasetId] &&
    isDeckMapTableDatasetSource(config.datasets[datasetId]?.source)
      ? config.datasets[datasetId]?.source.transformSql?.trim()
      : undefined;
  if (transformSql && required.length === 0) return false;
  if (required.length === 0) return true;
  const columnNames = new Set(table.columns.map((column) => column.name));
  return required.every((name) => columnNames.has(name));
}

function snapshotDeckMapTableState(
  config: DeckMapDashboardPanelConfig,
): DeckMapTableHistorySnapshot {
  return {
    spec: config.spec,
    datasets: config.datasets,
    ...(config.fitToData ? {fitToData: config.fitToData} : {}),
    ...(config.interaction ? {interaction: config.interaction} : {}),
  };
}

function deckMapTableHistoryKeysFromTableName(tableName: string): string[] {
  const keys = new Set<string>([tableName]);
  const quoted = quoteParsedRawSqlTableReference(tableName);
  if (quoted) keys.add(quoted);
  return [...keys];
}

function deckMapTableHistoryKeysFromTable(table: DataTable): string[] {
  const keys = new Set(deckMapTableHistoryKeysFromTableName(table.tableName));
  keys.add(quoteDeckMapSqlTableReference(table.table));
  return [...keys];
}

function rememberDeckMapTableHistory(
  history: Record<string, DeckMapTableHistorySnapshot> | undefined,
  keys: string[],
  snapshot: DeckMapTableHistorySnapshot,
): Record<string, DeckMapTableHistorySnapshot> {
  const next = {...history};
  for (const key of keys) {
    next[key] = snapshot;
  }
  return next;
}

function findDeckMapTableHistorySnapshot(
  history: Record<string, DeckMapTableHistorySnapshot> | undefined,
  keys: string[],
): DeckMapTableHistorySnapshot | undefined {
  if (!history) return undefined;
  for (const key of keys) {
    const snapshot = history[key];
    if (snapshot) return snapshot;
  }
  return undefined;
}

function remapDeckMapConfigDatasetId(
  config: DeckMapConfig,
  fromId: string | undefined,
  toId: string,
): DeckMapConfig {
  if (!fromId || fromId === toId) return config;
  const dataset = config.datasets?.[fromId];
  if (!dataset) return config;

  const spec = isDeckMapConfigRecord(config.spec)
    ? {
        ...config.spec,
        ...(Array.isArray(config.spec.layers)
          ? {
              layers: config.spec.layers.map((layer) => {
                if (!isDeckMapConfigRecord(layer)) return layer;
                const binding = isDeckMapConfigRecord(layer._sqlroomsBinding)
                  ? layer._sqlroomsBinding
                  : undefined;
                const nextBinding =
                  binding?.dataset === fromId
                    ? {...binding, dataset: toId}
                    : binding;
                return {
                  ...layer,
                  ...(layer.id === fromId ? {id: toId} : {}),
                  ...(nextBinding ? {_sqlroomsBinding: nextBinding} : {}),
                };
              }),
            }
          : {}),
      }
    : config.spec;

  return {
    ...config,
    spec,
    datasets: {[toId]: dataset},
    fitToData:
      config.fitToData?.dataset === fromId
        ? {...config.fitToData, dataset: toId}
        : config.fitToData,
    interaction:
      config.interaction?.dataset === fromId
        ? {...config.interaction, dataset: toId}
        : config.interaction,
  };
}

function retargetDeckMapDatasetTableName(
  config: DeckMapConfig,
  table: DataTable,
): DeckMapConfig {
  const datasetIds = Object.keys(config.datasets ?? {});
  if (datasetIds.length !== 1) return config;
  const datasetId = datasetIds[0]!;
  const dataset = config.datasets[datasetId];
  if (!dataset || !isDeckMapTableDatasetSource(dataset.source)) {
    return config;
  }

  const tableName = quoteDeckMapSqlTableReference(table.table);
  if (dataset.source.tableName === tableName) return config;

  return {
    ...config,
    datasets: {
      ...config.datasets,
      [datasetId]: {
        ...dataset,
        source: {
          ...dataset.source,
          tableName,
        },
      },
    },
  };
}

function normalizeDeckMapPointLayers<T extends unknown[]>(options: {
  layers: T;
  datasetId: string;
  datasetIds: string[];
  geometryColumn: string;
}): T {
  let changed = false;
  const layers = options.layers.map((layer) => {
    if (!isDeckMapConfigRecord(layer)) {
      return layer;
    }

    const layerType = layer['@@type'];
    if (
      typeof layerType !== 'string' ||
      !DECK_MAP_POINT_LAYER_TYPES.has(layerType) ||
      !deckMapLayerTargetsDataset({
        layer,
        datasetId: options.datasetId,
        datasetIds: options.datasetIds,
      })
    ) {
      return layer;
    }

    changed = true;
    const binding = isDeckMapConfigRecord(layer._sqlroomsBinding)
      ? layer._sqlroomsBinding
      : {};
    const geometryBinding = {...binding};
    delete geometryBinding.longitudeColumn;
    delete geometryBinding.latitudeColumn;
    const pointLayer = {...layer};
    delete pointLayer.getPosition;

    return {
      ...pointLayer,
      _sqlroomsBinding: {
        ...geometryBinding,
        dataset:
          typeof binding.dataset === 'string'
            ? binding.dataset
            : options.datasetId,
        geometryColumn: options.geometryColumn,
      },
    };
  });

  return (changed ? layers : options.layers) as T;
}

/**
 * Applies a structured longitude/latitude point binding to a native Deck map
 * config. The generated geometry SQL intentionally comes from the same
 * canonical helper used by first-party map builders.
 */
export function applyDeckMapPointBinding<
  T extends DeckMapDashboardPanelConfig,
>(options: {
  config: T;
  pointBinding: DeckMapPointBinding;
  sourceColumns: readonly DeckMapConfigColumn[];
}): T {
  const {config, pointBinding} = options;
  const datasetId = pointBinding.dataset.trim();
  const longitudeColumn = pointBinding.longitudeColumn.trim();
  const latitudeColumn = pointBinding.latitudeColumn.trim();
  if (!datasetId || !longitudeColumn || !latitudeColumn) {
    throw new Error(
      'Point binding requires dataset, longitudeColumn, and latitudeColumn.',
    );
  }

  const dataset = config.datasets[datasetId];
  if (!dataset) {
    throw new Error(`Point binding references unknown dataset "${datasetId}".`);
  }
  if (!isDeckMapTableDatasetSource(dataset.source)) {
    throw new Error(
      `Point binding dataset "${datasetId}" must use source.tableName.`,
    );
  }

  const geometryColumn =
    pointBinding.geometryColumn?.trim() || DEFAULT_GEOMETRY_COLUMN;
  const sourceColumnNames = new Set(
    options.sourceColumns.map((column) => column.name.toLowerCase()),
  );
  for (const [bindingName, columnName] of [
    ['longitudeColumn', longitudeColumn],
    ['latitudeColumn', latitudeColumn],
  ] as const) {
    if (!sourceColumnNames.has(columnName.toLowerCase())) {
      throw new Error(
        `Point binding ${bindingName} "${columnName}" was not found in source columns.`,
      );
    }
  }
  if (sourceColumnNames.has(geometryColumn.toLowerCase())) {
    throw new Error(
      `Point binding geometryColumn "${geometryColumn}" conflicts with an existing source column.`,
    );
  }
  const datasetIds = Object.keys(config.datasets);
  let parsedSpec: unknown = config.spec;
  if (typeof parsedSpec === 'string') {
    try {
      parsedSpec = JSON.parse(parsedSpec);
    } catch {
      // Durable resource validation reports the invalid serialized spec.
    }
  }
  const spec = isDeckMapConfigRecord(parsedSpec)
    ? {
        ...parsedSpec,
        ...(Array.isArray(parsedSpec.layers)
          ? {
              layers: normalizeDeckMapPointLayers({
                layers: parsedSpec.layers,
                datasetId,
                datasetIds,
                geometryColumn,
              }),
            }
          : {}),
      }
    : parsedSpec;
  let fitToData = config.fitToData;
  if (isDeckMapConfigRecord(fitToData) && fitToData.dataset === datasetId) {
    const geometryFit = {...fitToData};
    delete geometryFit.longitudeColumn;
    delete geometryFit.latitudeColumn;
    delete geometryFit.geometryColumns;
    delete geometryFit.h3Column;
    fitToData = {...geometryFit, geometryColumn};
  } else if (!fitToData) {
    fitToData = {
      dataset: datasetId,
      geometryColumn,
      padding: 40,
      maxZoom: 12,
    };
  }
  const interaction =
    config.interaction?.type === 'point-radius-brush' &&
    config.interaction.dataset === datasetId
      ? {...config.interaction, longitudeColumn, latitudeColumn}
      : config.interaction;

  return {
    ...config,
    spec,
    ...(interaction !== config.interaction ? {interaction} : {}),
    datasets: {
      ...config.datasets,
      [datasetId]: {
        ...dataset,
        source: {
          tableName: dataset.source.tableName,
          transformSql: createDeckMapPointTransformSql({
            longitudeColumn,
            latitudeColumn,
            geometryColumn,
          }),
        },
        geometryColumn,
        geometryEncodingHint: 'wkb',
      },
    },
    fitToData,
  } as T;
}

/**
 * Post-normalizes an existing Deck map config so table-backed lon/lat datasets
 * without `transformSql`, `sqlQuery`, or a native geometry column get a WKB
 * point transform, geometry bindings, and `fitToData.geometryColumn` alignment.
 *
 * Prefer this for AI/tool configs that arrive without a transform. Fresh configs
 * from {@link createDeckMapDashboardConfigForTable} already include the transform;
 * this helper patches in place without rebuilding layers.
 */
export function normalizeDeckMapPointConfig<
  T extends DeckMapDashboardPanelConfig,
>(options: {
  config: T;
  resolveTable: (tableName: string) => DataTable | undefined;
}): T {
  const {config, resolveTable} = options;
  const datasets = isDeckMapConfigRecord(config.datasets)
    ? config.datasets
    : undefined;
  if (!datasets) {
    return config;
  }

  const datasetIds = Object.keys(datasets);
  let nextDatasets = datasets;
  let nextSpec = config.spec;
  let nextFitToData = config.fitToData;
  let changed = false;

  for (const [datasetId, datasetValue] of Object.entries(datasets)) {
    if (!isDeckMapConfigRecord(datasetValue)) {
      continue;
    }
    const dataset = datasetValue;

    const source = isDeckMapConfigRecord(dataset.source as unknown)
      ? (dataset.source as Record<string, unknown>)
      : undefined;
    const tableName =
      typeof source?.tableName === 'string' ? source.tableName : undefined;
    const configuredGeometryColumn =
      typeof dataset.geometryColumn === 'string'
        ? dataset.geometryColumn.trim()
        : undefined;
    if (
      !tableName ||
      source?.sqlQuery ||
      source?.transformSql ||
      (configuredGeometryColumn &&
        configuredGeometryColumn !== DEFAULT_GEOMETRY_COLUMN)
    ) {
      continue;
    }

    const table = resolveTable(tableName);
    if (
      configuredGeometryColumn === DEFAULT_GEOMETRY_COLUMN &&
      table?.columns.some((column) => column.name === configuredGeometryColumn)
    ) {
      continue;
    }
    if (findGeometryColumn(table)) {
      continue;
    }
    const coordinateColumns = findLongitudeLatitudeColumns(table);
    if (!coordinateColumns) {
      continue;
    }

    const geometryColumn = DEFAULT_GEOMETRY_COLUMN;

    nextDatasets = {
      ...nextDatasets,
      [datasetId]: {
        ...dataset,
        source: {
          ...source,
          tableName,
          transformSql: createDeckMapPointTransformSql({
            ...coordinateColumns,
            geometryColumn,
          }),
        },
        geometryColumn,
        geometryEncodingHint: 'wkb',
      },
    };

    if (
      isDeckMapConfigRecord(nextSpec) &&
      Array.isArray(nextSpec.layers) &&
      nextSpec.layers.length > 0
    ) {
      nextSpec = {
        ...nextSpec,
        layers: normalizeDeckMapPointLayers({
          layers: nextSpec.layers,
          datasetId,
          datasetIds,
          geometryColumn,
        }),
      };
    }

    nextFitToData =
      isDeckMapConfigRecord(nextFitToData) &&
      nextFitToData.dataset === datasetId
        ? {
            ...nextFitToData,
            geometryColumn,
          }
        : (nextFitToData ?? {
            dataset: datasetId,
            geometryColumn,
            padding: 40,
            maxZoom: 12,
          });

    changed = true;
  }

  if (!changed) {
    return config;
  }

  return {
    ...config,
    spec: nextSpec,
    datasets: nextDatasets,
    fitToData: nextFitToData,
  } as T;
}

export function normalizeDeckMapFillColor(
  fillColor?: number[],
): DeckMapFillColor {
  if (fillColor?.length === 3) {
    return [fillColor[0]!, fillColor[1]!, fillColor[2]!];
  }
  if (fillColor?.length === 4) {
    return [fillColor[0]!, fillColor[1]!, fillColor[2]!, fillColor[3]!];
  }
  return [...DEFAULT_FILL_COLOR];
}

export function createDeckMapConfigForTable(options: {
  tableName: string;
  columns: DeckMapConfigColumn[];
  tableReference?: DeckMapTableReference;
  sourceSqlQuery?: string;
  longitudeColumn?: string;
  latitudeColumn?: string;
  geometryColumn?: string;
  geometryEncodingHint?: GeometryEncodingHint;
  pointRadius?: number;
  fillColor?: DeckMapFillColor;
  mapStyle?: string;
}): DeckMapConfig {
  const datasetId = options.tableName;
  const explicitGeometryColumn = options.geometryColumn?.trim() || undefined;
  const detectedCoordinates =
    options.longitudeColumn && options.latitudeColumn
      ? {
          longitudeColumn: options.longitudeColumn,
          latitudeColumn: options.latitudeColumn,
        }
      : findDeckMapLongitudeLatitudeColumns(options.columns);
  const detectedGeometryColumn = explicitGeometryColumn
    ? {
        geometryColumn: explicitGeometryColumn,
        geometryEncodingHint: options.geometryEncodingHint,
      }
    : detectedCoordinates
      ? null
      : findDeckMapGeometryColumn(options.columns);
  const coordinates = detectedGeometryColumn
    ? undefined
    : resolveDeckMapCoordinateColumns({
        columns: options.columns,
        longitudeColumn: options.longitudeColumn,
        latitudeColumn: options.latitudeColumn,
      });
  const geometryColumn =
    detectedGeometryColumn?.geometryColumn ?? DEFAULT_GEOMETRY_COLUMN;
  const geometryEncodingHint =
    options.geometryEncodingHint ??
    detectedGeometryColumn?.geometryEncodingHint;
  const source = coordinates
    ? options.sourceSqlQuery
      ? {
          sqlQuery: createDeckMapPointSourceSql({
            sourceSqlQuery: options.sourceSqlQuery,
            tableReference: options.tableReference ?? options.tableName,
            longitudeColumn: coordinates.longitudeColumn,
            latitudeColumn: coordinates.latitudeColumn,
            geometryColumn,
          }),
        }
      : {
          tableName: options.tableReference
            ? quoteDeckMapSqlTableReference(options.tableReference)
            : options.tableName,
          transformSql: createDeckMapPointTransformSql({
            longitudeColumn: coordinates.longitudeColumn,
            latitudeColumn: coordinates.latitudeColumn,
            geometryColumn,
          }),
        }
    : options.sourceSqlQuery
      ? {sqlQuery: options.sourceSqlQuery}
      : {tableName: options.tableName};

  if (detectedGeometryColumn) {
    ensureDeckMapColumnExists(
      options.columns,
      detectedGeometryColumn.geometryColumn,
      'geometry',
    );
  }

  return {
    spec: {
      initialViewState: {longitude: 0, latitude: 20, zoom: 1.5},
      layers: [
        {
          '@@type': coordinates
            ? 'GeoArrowScatterplotLayer'
            : 'GeoArrowPolygonLayer',
          id: datasetId,
          _sqlroomsBinding: {
            dataset: datasetId,
            ...(detectedGeometryColumn
              ? {geometryColumn: detectedGeometryColumn.geometryColumn}
              : {}),
          },
          filled: true,
          stroked: false,
          pickable: true,
          radiusUnits: 'pixels',
          getRadius: options.pointRadius ?? 4,
          getFillColor: options.fillColor ?? [...DEFAULT_FILL_COLOR],
        },
      ],
    },
    datasets: {
      [datasetId]: {
        source,
        geometryColumn,
        geometryEncodingHint: coordinates ? 'wkb' : geometryEncodingHint,
      },
    },
    ...(coordinates
      ? {
          fitToData: {
            dataset: datasetId,
            longitudeColumn: coordinates.longitudeColumn,
            latitudeColumn: coordinates.latitudeColumn,
            padding: 40,
            maxZoom: 12,
          },
        }
      : detectedGeometryColumn
        ? {
            fitToData: {
              dataset: datasetId,
              geometryColumn: detectedGeometryColumn.geometryColumn,
              padding: 40,
              maxZoom: 12,
            },
          }
        : {}),
    mapStyle: options.mapStyle ?? getDefaultDeckMapStyle(),
  };
}

export const createDeckMapDashboardConfigForTable = createDeckMapConfigForTable;

export function createDeckMapDashboardPanelConfigForTable(options: {
  title?: string;
  tableName: string;
  columns: DeckMapConfigColumn[];
  tableReference?: DeckMapTableReference;
  sourceSqlQuery?: string;
  longitudeColumn?: string;
  latitudeColumn?: string;
  geometryColumn?: string;
  geometryEncodingHint?: GeometryEncodingHint;
  pointRadius?: number;
  fillColor?: DeckMapFillColor;
  mapStyle?: string;
}) {
  return createDeckMapDashboardPanelConfig({
    title: options.title,
    ...createDeckMapConfigForTable(options),
  });
}

/**
 * Regenerates a map's dataset source and fit configuration for a table while
 * preserving an existing single dataset ID so retained layer bindings remain
 * valid. Empty maps adopt the generated dataset and layer spec. Returns the
 * existing config unchanged when the table has no supported geospatial columns
 * or when multiple datasets make the target ambiguous.
 *
 * Authored arc, H3, trips, and path transforms are kept when the new table
 * still has the columns they read. Otherwise the current map is snapshotted in
 * `tableHistory` and either restored for that table or replaced with a
 * generated point/polygon map so the new dataset can render.
 */
export function regenerateMapConfigForTable(
  panel: {config: Record<string, unknown>},
  table: DataTable,
  longitudeColumn?: string,
  latitudeColumn?: string,
) {
  const existingConfig = panel.config as DeckMapDashboardPanelConfig;
  const existingDatasetIds = Object.keys(existingConfig.datasets ?? {});
  if (existingDatasetIds.length > 1) return panel.config;

  const coordinateColumns = resolveDeckMapCoordinateColumnNames({
    columns: table.columns,
    longitudeColumn,
    latitudeColumn,
  });
  const hasGeospatialColumns = Boolean(
    coordinateColumns || findGeometryColumn(table),
  );

  if (existingDatasetIds.length === 0) {
    if (!hasGeospatialColumns) return panel.config;
    const nextConfig = createDeckMapConfigForTable({
      tableName: table.tableName,
      columns: table.columns,
      tableReference: table.table,
      longitudeColumn: coordinateColumns?.longitudeColumn,
      latitudeColumn: coordinateColumns?.latitudeColumn,
    });
    return {
      ...nextConfig,
      mapStyle: existingConfig.mapStyle,
      mapProps: existingConfig.mapProps,
    };
  }

  const datasetId = existingDatasetIds[0]!;
  const existingDataset = existingConfig.datasets?.[datasetId];
  const existingSource =
    existingDataset && isDeckMapTableDatasetSource(existingDataset.source)
      ? existingDataset.source
      : undefined;
  const nextTableName = quoteDeckMapSqlTableReference(table.table);
  if (existingSource?.tableName === nextTableName) {
    return existingConfig;
  }

  const hasCustomTransform = deckMapDatasetHasCustomTransform(
    existingConfig,
    datasetId,
  );
  const compatible = deckMapSourceCompatibleWithTable(
    existingConfig,
    datasetId,
    table,
  );
  const outgoingKeys = deckMapTableHistoryKeysFromTable(table);
  const incomingKeys = existingSource
    ? deckMapTableHistoryKeysFromTableName(existingSource.tableName)
    : [];
  const restoredSnapshot = findDeckMapTableHistorySnapshot(
    existingConfig.tableHistory,
    outgoingKeys,
  );
  const shouldRememberCurrent =
    hasCustomTransform ||
    Boolean(restoredSnapshot) ||
    Boolean(existingConfig.tableHistory);

  let history = existingConfig.tableHistory;
  if (shouldRememberCurrent && incomingKeys.length > 0) {
    history = rememberDeckMapTableHistory(
      history,
      incomingKeys,
      snapshotDeckMapTableState(existingConfig),
    );
  }

  if (restoredSnapshot) {
    return retargetDeckMapDatasetTableName(
      {
        ...existingConfig,
        spec: restoredSnapshot.spec,
        datasets: restoredSnapshot.datasets,
        fitToData: restoredSnapshot.fitToData,
        interaction: restoredSnapshot.interaction,
        tableHistory: history,
      },
      table,
    );
  }

  if (hasCustomTransform && compatible) {
    return retargetDeckMapDatasetTableName(existingConfig, table);
  }

  if (!hasGeospatialColumns) {
    return panel.config;
  }

  const nextConfig = createDeckMapConfigForTable({
    tableName: table.tableName,
    columns: table.columns,
    tableReference: table.table,
    longitudeColumn: coordinateColumns?.longitudeColumn,
    latitudeColumn: coordinateColumns?.latitudeColumn,
  });
  const nextDataset = Object.values(nextConfig.datasets)[0];
  const generatedDatasetId = Object.keys(nextConfig.datasets)[0];
  if (!nextDataset) return panel.config;

  if (hasCustomTransform) {
    const remapped = remapDeckMapConfigDatasetId(
      {
        ...nextConfig,
        mapStyle: existingConfig.mapStyle ?? nextConfig.mapStyle,
        mapProps: existingConfig.mapProps,
      },
      generatedDatasetId ?? table.tableName,
      datasetId,
    );
    return {
      ...remapped,
      tableHistory: history,
      showLegends: existingConfig.showLegends,
      configMode: existingConfig.configMode,
      dataPolicy: existingConfig.dataPolicy,
      settingsOpen: existingConfig.settingsOpen,
    };
  }

  return updateDeckMapGeometryColumnBindings(
    {
      ...existingConfig,
      datasets: {[datasetId]: nextDataset},
      fitToData: nextConfig.fitToData
        ? {...nextConfig.fitToData, dataset: datasetId}
        : existingConfig.fitToData,
    },
    datasetId,
    nextDataset.geometryColumn,
  );
}

/**
 * Applies a document map table pick: regenerate geospatial config when
 * possible, otherwise retarget the single table-backed dataset.
 */
export function applyDeckMapTableSelection(
  config: DeckMapConfig,
  table: DataTable,
  longitudeColumn?: string,
  latitudeColumn?: string,
): DeckMapConfig {
  const regenerated = regenerateMapConfigForTable(
    {config},
    table,
    longitudeColumn,
    latitudeColumn,
  );
  if (regenerated !== config) {
    return regenerated as DeckMapConfig;
  }

  return retargetDeckMapDatasetTableName(config, table);
}
