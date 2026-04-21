import type * as arrow from 'apache-arrow';
import type {ResolvedGeometryColumn, ResolvedGeometryEncoding} from './types';
import {buildBinaryGeoJsonData} from './toGeoJsonBinary';

function itemLength(value: unknown) {
  if (Array.isArray(value)) {
    return value.length;
  }
  if (value && typeof value === 'object' && 'length' in value) {
    return Number((value as {length: number}).length);
  }
  return 0;
}

function itemAt(value: unknown, index: number): unknown {
  if (Array.isArray(value)) {
    return value[index];
  }
  if (value && typeof value === 'object' && 'get' in value) {
    return (value as {get: (index: number) => unknown}).get(index);
  }
  return undefined;
}

function toCoordinates(value: unknown): number[] {
  return Array.from(value as Iterable<number>, (coordinate) =>
    Number(coordinate),
  );
}

function pointToGeometry(value: unknown) {
  return {type: 'Point', coordinates: toCoordinates(value)};
}

function multiPointToGeometry(value: unknown) {
  const coordinates = [];
  for (let index = 0; index < itemLength(value); index++) {
    const point = itemAt(value, index);
    if (point) {
      coordinates.push(toCoordinates(point));
    }
  }
  return {type: 'MultiPoint', coordinates};
}

function lineStringToGeometry(value: unknown) {
  const coordinates = [];
  for (let index = 0; index < itemLength(value); index++) {
    const point = itemAt(value, index);
    if (point) {
      coordinates.push(toCoordinates(point));
    }
  }
  return {type: 'LineString', coordinates};
}

function multiLineStringToGeometry(value: unknown) {
  const coordinates = [];
  for (let index = 0; index < itemLength(value); index++) {
    const lineString = itemAt(value, index);
    if (lineString) {
      coordinates.push(lineStringToGeometry(lineString).coordinates);
    }
  }
  return {type: 'MultiLineString', coordinates};
}

function polygonToGeometry(value: unknown) {
  const coordinates = [];
  for (let ringIndex = 0; ringIndex < itemLength(value); ringIndex++) {
    const ring = itemAt(value, ringIndex);
    if (ring) {
      coordinates.push(lineStringToGeometry(ring).coordinates);
    }
  }
  return {type: 'Polygon', coordinates};
}

function multiPolygonToGeometry(value: unknown) {
  const coordinates = [];
  for (let polygonIndex = 0; polygonIndex < itemLength(value); polygonIndex++) {
    const polygon = itemAt(value, polygonIndex);
    if (polygon) {
      coordinates.push(polygonToGeometry(polygon).coordinates);
    }
  }
  return {type: 'MultiPolygon', coordinates};
}

export function isDirectGeoArrowEncoding(
  encoding: ResolvedGeometryEncoding,
): boolean {
  return [
    'geoarrow.point',
    'geoarrow.multipoint',
    'geoarrow.linestring',
    'geoarrow.multilinestring',
    'geoarrow.polygon',
    'geoarrow.multipolygon',
  ].includes(encoding);
}

export function convertGeoArrowCellToGeometry(
  value: unknown,
  encoding: ResolvedGeometryEncoding,
) {
  if (value == null) {
    return null;
  }

  switch (encoding) {
    case 'geoarrow.point':
      return pointToGeometry(value);
    case 'geoarrow.multipoint':
      return multiPointToGeometry(value);
    case 'geoarrow.linestring':
      return lineStringToGeometry(value);
    case 'geoarrow.multilinestring':
      return multiLineStringToGeometry(value);
    case 'geoarrow.polygon':
      return polygonToGeometry(value);
    case 'geoarrow.multipolygon':
      return multiPolygonToGeometry(value);
    default:
      return null;
  }
}

export function buildNativeGeoArrowBinaryData(
  table: arrow.Table,
  geometry: ResolvedGeometryColumn,
): unknown {
  return buildBinaryGeoJsonData({
    table,
    geometryColumnName: geometry.columnName,
    getGeometryAt: (rowIndex) =>
      convertGeoArrowCellToGeometry(
        geometry.vector.get(rowIndex),
        geometry.encoding,
      ),
  });
}
