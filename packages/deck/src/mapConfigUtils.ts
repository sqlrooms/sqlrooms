import type {MosaicDashboardPanelConfigType} from '@sqlrooms/mosaic';
import type {DataTable} from '@sqlrooms/duckdb';

const LONGITUDE_COLUMN_NAMES = ['longitude', 'lon', 'lng', 'long', 'x'];
const LATITUDE_COLUMN_NAMES = ['latitude', 'lat', 'y'];

function findColumnByName(table: DataTable, candidates: string[]) {
  const candidateSet = new Set(candidates);
  return table.columns.find((column) =>
    candidateSet.has(column.name.toLowerCase()),
  )?.name;
}

export function findLongitudeLatitudeColumns(table?: DataTable) {
  if (!table) return null;
  const longitudeColumn = findColumnByName(table, LONGITUDE_COLUMN_NAMES);
  const latitudeColumn = findColumnByName(table, LATITUDE_COLUMN_NAMES);
  return longitudeColumn && latitudeColumn
    ? {longitudeColumn, latitudeColumn}
    : null;
}

function quoteSqlIdentifier(identifier: string) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function quoteTableReference(table: DataTable) {
  const qualifiedName = table.table;
  return [qualifiedName.database, qualifiedName.schema, qualifiedName.table]
    .filter((part): part is string => Boolean(part))
    .map(quoteSqlIdentifier)
    .join('.');
}

export function regenerateMapConfigForTable(
  panel: MosaicDashboardPanelConfigType,
  table: DataTable,
  longitudeColumn?: string,
  latitudeColumn?: string,
) {
  // Use provided columns or auto-detect
  const coordinates =
    longitudeColumn && latitudeColumn
      ? {longitudeColumn, latitudeColumn}
      : findLongitudeLatitudeColumns(table);

  if (!coordinates) return panel.config;

  const {longitudeColumn: lonCol, latitudeColumn: latCol} = coordinates;
  const datasetId = table.table.table;
  const geometryColumn = '__sqlrooms_geom';
  const quotedLongitude = quoteSqlIdentifier(lonCol);
  const quotedLatitude = quoteSqlIdentifier(latCol);

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
          getRadius: 4,
          getFillColor: [56, 189, 248, 180],
        },
      ],
    },
    datasets: {
      [datasetId]: {
        source: {
          sqlQuery: [
            `SELECT *, ST_AsWKB(ST_Point(${quotedLongitude}, ${quotedLatitude})) AS ${quoteSqlIdentifier(geometryColumn)}`,
            `FROM ${quoteTableReference(table)}`,
            `WHERE ${quotedLongitude} IS NOT NULL AND ${quotedLatitude} IS NOT NULL`,
          ].join(' '),
        },
        geometryColumn,
        geometryEncodingHint: 'wkb',
      },
    },
    fitToData: {
      dataset: datasetId,
      longitudeColumn: lonCol,
      latitudeColumn: latCol,
      padding: 40,
      maxZoom: 12,
    },
  };
}
