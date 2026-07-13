import {WebMercatorViewport} from '@deck.gl/core';
import {escapeId, getColValAsNumber} from '@sqlrooms/duckdb';
import type {Table as ArrowTable} from 'apache-arrow';
import {
  DeckTableDatasetInvalidTableNameError,
  createDeckTableDatasetSql,
} from './datasets/tableDatasetSql';
import type {DeckMapConfig, DeckMapFitToDataConfig} from './mapConfig';
import type {DeckDatasetInput} from './types';
import {isSqlDatasetInput, isTableDatasetInput} from './types';

type ResourceMapDatasetSource =
  | {sqlQuery: string}
  | {tableName: string; transformSql?: string};

export function resolveResourceMapFitToData(
  config: DeckMapConfig,
): DeckMapFitToDataConfig | null {
  const fitToData = config.fitToData;
  if (!fitToData?.dataset) return null;
  if (fitToData.longitudeColumn && fitToData.latitudeColumn) return fitToData;

  const dataset = config.datasets[fitToData.dataset];
  const geometryColumn = fitToData.geometryColumn ?? dataset?.geometryColumn;
  if (geometryColumn) return {...fitToData, geometryColumn};

  if (config.interaction?.longitudeColumn && config.interaction.latitudeColumn) {
    return {
      ...fitToData,
      longitudeColumn: config.interaction.longitudeColumn,
      latitudeColumn: config.interaction.latitudeColumn,
    };
  }

  const spec =
    typeof config.spec === 'string'
      ? undefined
      : (config.spec as Record<string, unknown>);
  const layers = Array.isArray(spec?.layers) ? spec.layers : [];
  for (const layer of layers) {
    if (!layer || typeof layer !== 'object') continue;
    const binding = (layer as Record<string, unknown>)._sqlroomsBinding as
      | Record<string, unknown>
      | undefined;
    if (binding?.dataset === fitToData.dataset && binding.hexagonColumn) {
      return {...fitToData, h3Column: String(binding.hexagonColumn)};
    }
  }

  return fitToData;
}

export function getResourceMapDatasetSource(
  dataset: DeckDatasetInput | undefined,
): ResourceMapDatasetSource | null {
  if (!dataset) return null;
  if (isSqlDatasetInput(dataset)) return {sqlQuery: dataset.sqlQuery};
  if (isTableDatasetInput(dataset)) {
    return {
      tableName: dataset.tableName,
      transformSql: dataset.transformSql,
    };
  }
  return null;
}

export function createResourceMapBoundsQuery(options: {
  source: ResourceMapDatasetSource;
  fitToData: DeckMapFitToDataConfig;
}) {
  const {source, fitToData} = options;
  if (!fitToData.dataset) return null;
  const baseSourceSql =
    'sqlQuery' in source
      ? `SELECT * FROM (${source.sqlQuery}) AS "__sqlrooms_resource_map_source"`
      : createResourceMapBoundsTableSourceSql(source);

  if (fitToData.h3Column) {
    const column = escapeId(fitToData.h3Column);
    return `
      SELECT
        MIN(h3_cell_to_lng(${column})) AS min_longitude,
        MIN(h3_cell_to_lat(${column})) AS min_latitude,
        MAX(h3_cell_to_lng(${column})) AS max_longitude,
        MAX(h3_cell_to_lat(${column})) AS max_latitude
      FROM (${baseSourceSql}) AS "__sqlrooms_resource_map_h3"
      WHERE ${column} IS NOT NULL
    `;
  }

  if (fitToData.geometryColumn) {
    const column = escapeId(fitToData.geometryColumn);
    const sourceSql =
      'sqlQuery' in source ? source.sqlQuery : (source.transformSql ?? '');
    const geometry = sourceSql.toLowerCase().includes('st_aswkb')
      ? `ST_GeomFromWKB(${column})`
      : `${column}::GEOMETRY`;
    return `
      SELECT
        ST_XMin(extent) AS min_longitude,
        ST_YMin(extent) AS min_latitude,
        ST_XMax(extent) AS max_longitude,
        ST_YMax(extent) AS max_latitude
      FROM (
        SELECT ST_Extent_Agg(${geometry}) AS extent
        FROM (${baseSourceSql}) AS "__sqlrooms_resource_map_geom"
        WHERE ${column} IS NOT NULL
      ) AS "__sqlrooms_resource_map_extent"
      WHERE extent IS NOT NULL
    `;
  }

  if (fitToData.longitudeColumn && fitToData.latitudeColumn) {
    const longitude = escapeId(fitToData.longitudeColumn);
    const latitude = escapeId(fitToData.latitudeColumn);
    return `
      SELECT
        ST_XMin(extent) AS min_longitude,
        ST_YMin(extent) AS min_latitude,
        ST_XMax(extent) AS max_longitude,
        ST_YMax(extent) AS max_latitude
      FROM (
        SELECT ST_Extent_Agg(ST_Point(${longitude}, ${latitude})) AS extent
        FROM (${baseSourceSql}) AS "__sqlrooms_resource_map_points"
        WHERE ${longitude} IS NOT NULL AND ${latitude} IS NOT NULL
      ) AS "__sqlrooms_resource_map_extent"
      WHERE extent IS NOT NULL
    `;
  }

  return null;
}

function createResourceMapBoundsTableSourceSql(
  source: Extract<ResourceMapDatasetSource, {tableName: string}>,
) {
  try {
    return createDeckTableDatasetSql(source);
  } catch (error) {
    if (error instanceof DeckTableDatasetInvalidTableNameError) {
      throw new Error('Deck map fit-to-data requires a valid table source.');
    }
    throw error;
  }
}

export function readResourceMapBounds(result: ArrowTable) {
  const minLongitude = getColValAsNumber(result, 'min_longitude');
  const minLatitude = getColValAsNumber(result, 'min_latitude');
  const maxLongitude = getColValAsNumber(result, 'max_longitude');
  const maxLatitude = getColValAsNumber(result, 'max_latitude');
  if (
    !Number.isFinite(minLongitude) ||
    !Number.isFinite(minLatitude) ||
    !Number.isFinite(maxLongitude) ||
    !Number.isFinite(maxLatitude)
  ) {
    return null;
  }
  return [
    [
      minLongitude === maxLongitude ? minLongitude - 0.01 : minLongitude,
      minLatitude === maxLatitude ? minLatitude - 0.01 : minLatitude,
    ],
    [
      minLongitude === maxLongitude ? maxLongitude + 0.01 : maxLongitude,
      minLatitude === maxLatitude ? maxLatitude + 0.01 : maxLatitude,
    ],
  ] as const;
}

export function fitResourceMapView(options: {
  bounds: readonly [readonly [number, number], readonly [number, number]];
  width: number;
  height: number;
  padding?: number;
  maxZoom?: number;
}) {
  const {bounds, width, height, padding = 40, maxZoom = 18} = options;
  const fitted = new WebMercatorViewport({
    width: Math.max(width, 1),
    height: Math.max(height, 1),
  }).fitBounds(
    [
      [bounds[0][0], bounds[0][1]],
      [bounds[1][0], bounds[1][1]],
    ],
    {padding},
  ) as WebMercatorViewport & {
    longitude: number;
    latitude: number;
    zoom: number;
  };
  return {
    longitude: fitted.longitude,
    latitude: fitted.latitude,
    zoom: Math.min(fitted.zoom, maxZoom),
  };
}
