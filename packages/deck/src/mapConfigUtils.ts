import {
  getRawSqlTableReference,
  makeQualifiedTableName,
  quoteParsedRawSqlTableReference,
  type DataTable,
  type RawSqlTableReference,
} from '@sqlrooms/duckdb';
import {
  createDeckMapDashboardPanelConfig,
  type DeckMapDashboardPanelConfig,
  type DeckMapConfig,
} from './mapConfig';
import {DECK_TABLE_DATASET_SOURCE_RELATION} from './datasets/tableDatasetSql';
import type {GeometryEncodingHint} from './prepare/types';

const LONGITUDE_COLUMN_NAMES = ['longitude', 'lon', 'lng', 'long', 'x'];
const LATITUDE_COLUMN_NAMES = ['latitude', 'lat', 'y'];
const GEOMETRY_COLUMN_NAMES = ['geometry', 'geom'];
const DEFAULT_GEOMETRY_COLUMN = '__sqlrooms_geom';
const DEFAULT_FILL_COLOR = [56, 189, 248, 180] as const;

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

export function findDeckMapLongitudeLatitudeColumns(
  columns?: DeckMapConfigColumn[],
) {
  if (!columns) return null;
  const longitudeColumn = findColumnByName(columns, LONGITUDE_COLUMN_NAMES);
  const latitudeColumn = findColumnByName(columns, LATITUDE_COLUMN_NAMES);
  return longitudeColumn && latitudeColumn
    ? {longitudeColumn, latitudeColumn}
    : null;
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

const DECK_MAP_POINT_LAYER_TYPES = new Set([
  'GeoArrowScatterplotLayer',
  'GeoArrowHeatmapLayer',
  'GeoArrowColumnLayer',
]);

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

    return {
      ...layer,
      _sqlroomsBinding: {
        ...binding,
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
    if (
      !tableName ||
      source?.sqlQuery ||
      source?.transformSql ||
      (typeof dataset.geometryColumn === 'string' &&
        dataset.geometryColumn.trim())
    ) {
      continue;
    }

    const table = resolveTable(tableName);
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
    ...(options.mapStyle ? {mapStyle: options.mapStyle} : {}),
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
 * valid. Returns the existing config unchanged when the table has no supported
 * geospatial columns.
 */
export function regenerateMapConfigForTable(
  panel: {config: Record<string, unknown>},
  table: DataTable,
  longitudeColumn?: string,
  latitudeColumn?: string,
) {
  if (
    !(longitudeColumn && latitudeColumn) &&
    !findLongitudeLatitudeColumns(table) &&
    !findGeometryColumn(table)
  ) {
    return panel.config;
  }

  const existingConfig = panel.config as DeckMapDashboardPanelConfig;
  const nextConfig = createDeckMapConfigForTable({
    tableName: table.tableName,
    columns: table.columns,
    tableReference: table.table,
    longitudeColumn,
    latitudeColumn,
  });
  const existingDatasetIds = Object.keys(existingConfig.datasets ?? {});
  const nextDataset = Object.values(nextConfig.datasets)[0];

  if (existingDatasetIds.length === 1 && nextDataset) {
    const datasetId = existingDatasetIds[0]!;
    return {
      ...existingConfig,
      datasets: {[datasetId]: nextDataset},
      fitToData: nextConfig.fitToData
        ? {...nextConfig.fitToData, dataset: datasetId}
        : existingConfig.fitToData,
    };
  }

  // Preserve existing layer spec (layer types, styling, bindings) — only
  // update the dataset source and fitToData so the data re-fetches with the
  // new coordinate columns.
  return {
    ...existingConfig,
    datasets: nextConfig.datasets,
    fitToData: nextConfig.fitToData ?? existingConfig.fitToData,
  };
}
