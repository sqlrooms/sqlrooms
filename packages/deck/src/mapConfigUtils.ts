import type {MosaicDashboardPanelConfigType} from '@sqlrooms/mosaic';
import type {DataTable} from '@sqlrooms/duckdb';
import {
  createDeckMapDashboardPanelConfig,
  type DeckMapDashboardPanelConfig,
} from './dashboardConfig';
import type {GeometryEncodingHint} from './prepare/types';

const LONGITUDE_COLUMN_NAMES = ['longitude', 'lon', 'lng', 'long', 'x'];
const LATITUDE_COLUMN_NAMES = ['latitude', 'lat', 'y'];
const DEFAULT_GEOMETRY_COLUMN = '__sqlrooms_geom';
const DEFAULT_FILL_COLOR = [56, 189, 248, 180] as const;

export type DeckMapConfigColumn = {name: string};
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
  return columns.find((column) =>
    candidateSet.has(column.name.toLowerCase()),
  )?.name;
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

export function quoteDeckMapSqlIdentifier(identifier: string) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

export function quoteDeckMapSqlTableReference(
  tableReference: DeckMapTableReference,
) {
  if (typeof tableReference === 'string') {
    return tableReference
      .split('.')
      .map((part) => quoteDeckMapSqlIdentifier(part))
      .join('.');
  }
  return [tableReference.database, tableReference.schema, tableReference.table]
    .filter((part): part is string => Boolean(part))
    .map(quoteDeckMapSqlIdentifier)
    .join('.');
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

export function createDeckMapDashboardConfigForTable(options: {
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
}): DeckMapDashboardPanelConfig {
  const datasetId = options.tableName;
  const explicitGeometryColumn = options.geometryColumn?.trim() || undefined;
  const coordinates = explicitGeometryColumn
    ? undefined
    : resolveDeckMapCoordinateColumns({
        columns: options.columns,
        longitudeColumn: options.longitudeColumn,
        latitudeColumn: options.latitudeColumn,
      });
  const geometryColumn = explicitGeometryColumn ?? DEFAULT_GEOMETRY_COLUMN;
  const source = coordinates
    ? {
        sqlQuery: createDeckMapPointSourceSql({
          sourceSqlQuery: options.sourceSqlQuery,
          tableReference: options.tableReference ?? options.tableName,
          longitudeColumn: coordinates.longitudeColumn,
          latitudeColumn: coordinates.latitudeColumn,
          geometryColumn,
        }),
      }
    : options.sourceSqlQuery
      ? {sqlQuery: options.sourceSqlQuery}
      : {tableName: options.tableName};

  if (explicitGeometryColumn) {
    ensureDeckMapColumnExists(options.columns, explicitGeometryColumn, 'geometry');
  }

  return {
    spec: {
      initialViewState: {longitude: 0, latitude: 20, zoom: 1.5},
      layers: [
        {
          '@@type': 'GeoArrowScatterplotLayer',
          id: datasetId,
          _sqlroomsBinding: {dataset: datasetId},
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
        geometryEncodingHint: explicitGeometryColumn
          ? options.geometryEncodingHint
          : 'wkb',
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
      : {}),
    ...(options.mapStyle ? {mapStyle: options.mapStyle} : {}),
  };
}

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
    ...createDeckMapDashboardConfigForTable(options),
  });
}

export function regenerateMapConfigForTable(
  panel: MosaicDashboardPanelConfigType,
  table: DataTable,
  longitudeColumn?: string,
  latitudeColumn?: string,
) {
  if (!(longitudeColumn && latitudeColumn) && !findLongitudeLatitudeColumns(table)) {
    return panel.config;
  }

  const existingConfig = panel.config as any;
  const nextConfig = createDeckMapDashboardConfigForTable({
    tableName: table.tableName,
    columns: table.columns,
    tableReference: table.table,
    longitudeColumn,
    latitudeColumn,
  });

  return {
    ...existingConfig,
    ...nextConfig,
  };
}
