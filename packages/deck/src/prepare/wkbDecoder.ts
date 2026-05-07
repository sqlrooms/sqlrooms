import {WKBLoader, WKTLoader} from '@loaders.gl/wkt';
import type * as arrow from 'apache-arrow';
import {
  Field,
  FixedSizeList,
  Float64,
  Table,
  vectorFromArray,
} from 'apache-arrow';
import type {GeometryDecoder} from './geometryDecoder';
import {buildBinaryGeoJsonData} from './toGeoJsonBinary';
import type {
  PreparedGeoArrowLayerData,
  ResolvedGeometryEncoding,
} from './types';

function toArrayBuffer(value: unknown) {
  if (ArrayBuffer.isView(value)) {
    const copy = new Uint8Array(value.byteLength);
    copy.set(
      new Uint8Array(value.buffer, value.byteOffset, value.byteLength),
      0,
    );
    return copy.buffer;
  }
  return value as ArrayBuffer;
}

function parseGeometryValue(
  value: unknown,
  encoding: ResolvedGeometryEncoding,
) {
  if (value == null) {
    return null;
  }

  try {
    if (
      encoding === 'wkt' ||
      encoding === 'geoarrow.wkt' ||
      (encoding === 'unknown' && typeof value === 'string')
    ) {
      return (
        WKTLoader.parseTextSync?.(String(value), {wkt: {crs: false}}) ?? null
      );
    }

    return (
      WKBLoader.parseSync?.(toArrayBuffer(value), {
        wkb: {shape: 'geojson-geometry'},
      }) ?? null
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('WKB: Unsupported geometry type: 0')) {
      throw new Error(
        'DuckDB GEOMETRY values are not WKB by default. Select ST_AsWKB(geom) AS geom or ST_AsText(geom) AS geom before passing the result to DeckJsonMap.',
      );
    }

    throw error instanceof Error ? error : new Error(message);
  }
}

function getSampleGeometry(
  table: arrow.Table,
  columnName: string,
  encoding: ResolvedGeometryEncoding,
) {
  const vector = table.getChild(columnName);
  if (!vector) {
    return null;
  }

  for (let rowIndex = 0; rowIndex < table.numRows; rowIndex++) {
    const geometry = parseGeometryValue(vector.get(rowIndex), encoding);
    if (geometry) {
      return geometry;
    }
  }

  return null;
}

/**
 * Attempt to promote WKB/WKT Point geometries into a native GeoArrow
 * FixedSizeList column.  Returns `null` if any non-null geometry is not
 * a Point, so callers can fall back to the GeoJSON binary path.
 */
function tryPromotePointTable(
  table: arrow.Table,
  columnName: string,
  encoding: ResolvedGeometryEncoding,
): PreparedGeoArrowLayerData | null {
  const vector = table.getChild(columnName);
  if (!vector) {
    return null;
  }

  const points = [];
  for (let rowIndex = 0; rowIndex < table.numRows; rowIndex++) {
    const geometry = parseGeometryValue(vector.get(rowIndex), encoding);
    if (!geometry) {
      points.push(null);
      continue;
    }

    if (geometry.type !== 'Point') {
      return null;
    }

    if (!('coordinates' in geometry)) {
      points.push(null);
      continue;
    }

    const coords = geometry.coordinates;
    if (
      !Array.isArray(coords) ||
      coords.length < 2 ||
      !Number.isFinite(coords[0]) ||
      !Number.isFinite(coords[1])
    ) {
      points.push(null);
      continue;
    }

    points.push([coords[0], coords[1]]);
  }

  const coordinateField = new Field('xy', new Float64());
  const geomType = new FixedSizeList(2, coordinateField);
  const promotedGeometry = vectorFromArray(points, geomType);

  const nextColumns: Record<string, arrow.Vector> = {};
  for (const field of table.schema.fields) {
    nextColumns[field.name] =
      field.name === columnName
        ? promotedGeometry
        : (table.getChild(field.name) as arrow.Vector);
  }

  const promotedTable = new Table(nextColumns);

  return {
    table: promotedTable,
    geometryColumnName: columnName,
    geometryColumn: promotedTable.getChild(columnName)!,
    encoding: 'geoarrow.point',
    source: 'promoted',
  };
}

export const wkbGeometryDecoder: GeometryDecoder = {
  supportsGeoArrowPromotion(
    layerType: string,
    encoding: ResolvedGeometryEncoding,
    table: arrow.Table,
    columnName: string,
  ) {
    if (
      !['wkb', 'geoarrow.wkb', 'wkt', 'geoarrow.wkt', 'unknown'].includes(
        encoding,
      )
    ) {
      return false;
    }

    if (
      ![
        'GeoArrowScatterplotLayer',
        'GeoArrowHeatmapLayer',
        'GeoArrowColumnLayer',
      ].includes(layerType)
    ) {
      return false;
    }

    const sampleGeometry = getSampleGeometry(table, columnName, encoding);
    return sampleGeometry == null || sampleGeometry.type === 'Point';
  },
  toGeoArrowLike(
    table: arrow.Table,
    columnName: string,
    encoding: ResolvedGeometryEncoding,
  ) {
    const result = tryPromotePointTable(table, columnName, encoding);
    if (!result) {
      throw new Error(
        'GeoArrow promotion failed: column contains non-Point geometries.',
      );
    }
    return result;
  },
  toGeoJsonBinary(
    table: arrow.Table,
    columnName: string,
    encoding: ResolvedGeometryEncoding,
  ) {
    return buildBinaryGeoJsonData({
      table,
      geometryColumnName: columnName,
      getGeometryAt: (rowIndex) => {
        const value = table.getChild(columnName)?.get(rowIndex);
        return parseGeometryValue(value, encoding);
      },
    });
  },
};
