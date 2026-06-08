import {WKBLoader, WKTLoader} from '@loaders.gl/wkt';
import type * as arrow from 'apache-arrow';
import {
  Field,
  FixedSizeList,
  Float64,
  List,
  makeData,
  Table,
  Vector,
} from 'apache-arrow';
import type {GeometryDecoder} from './geometryDecoder';
import {buildBinaryGeoJsonData} from './toGeoJsonBinary';
import type {
  PreparedGeoArrowLayerData,
  ResolvedGeometryEncoding,
} from './types';
import {
  parseWKBHeader,
  readWKBLineStringXY,
  readWKBPointXY,
  visitWKBMultiPolygonCoordinates,
  visitWKBPolygonCoordinates,
  WKB_LINESTRING,
  WKB_MULTIPOLYGON,
  WKB_POINT,
  WKB_POLYGON,
} from './wkbParser';

const COORD_FIELD = new Field('xy', new Float64(), false);
const VERTEX_TYPE = new FixedSizeList(2, COORD_FIELD);
const VERTEX_FIELD = new Field('', VERTEX_TYPE, true);
const RING_TYPE = new List(VERTEX_FIELD);
const RING_FIELD = new Field('', RING_TYPE, true);
const POLYGON_TYPE = new List(RING_FIELD);

const GEOMETRY_SAMPLE_LIMIT = 100;
const BITS_PER_VALIDITY_BYTE = 8;

function toArrayBuffer(value: unknown): ArrayBuffer {
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

function isWKTEncoding(
  encoding: ResolvedGeometryEncoding,
  value: unknown,
): boolean {
  return (
    encoding === 'wkt' ||
    encoding === 'geoarrow.wkt' ||
    (encoding === 'unknown' && typeof value === 'string')
  );
}

function buildNullBitmap(
  n: number,
  isNull: Uint8Array,
  nullCount: number,
): Uint8Array | null {
  if (nullCount === 0) return null;
  const bitmap = new Uint8Array(Math.ceil(n / BITS_PER_VALIDITY_BYTE));
  for (let i = 0; i < n; i++) {
    if (isNull[i] !== 1) setValidityBit(bitmap, i);
  }
  return bitmap;
}

function setValidityBit(bitmap: Uint8Array, rowIndex: number) {
  const byteIndex = Math.floor(rowIndex / BITS_PER_VALIDITY_BYTE);
  const bitIndex = rowIndex % BITS_PER_VALIDITY_BYTE;
  bitmap[byteIndex]! |= 1 << bitIndex;
}

function buildPromotedResult(
  table: arrow.Table,
  columnName: string,
  promotedGeometry: arrow.Vector,
  encoding: PreparedGeoArrowLayerData['encoding'],
): PreparedGeoArrowLayerData {
  const columns: Record<string, arrow.Vector> = {};
  for (const field of table.schema.fields) {
    columns[field.name] =
      field.name === columnName
        ? promotedGeometry
        : (table.getChild(field.name) as arrow.Vector);
  }
  const promotedTable = new Table(columns);
  return {
    table: promotedTable,
    geometryColumnName: columnName,
    geometryColumn: promotedTable.getChild(columnName)!,
    encoding,
    source: 'promoted',
  };
}

function parseGeometryValue(
  value: unknown,
  encoding: ResolvedGeometryEncoding,
) {
  if (value == null) return null;

  try {
    if (isWKTEncoding(encoding, value)) {
      // Keep WKT support for ST_AsText(...) and geoarrow.wkt inputs.
      // The upstream WKB parser plan does not cover WKT.
      // See: https://github.com/geoarrow/geoarrow-js/issues/54
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
    if (
      message.includes('WKB: Unsupported geometry type: 0') ||
      message.includes('WKB: Unsupported iso-wkb type')
    ) {
      throw new Error(
        'DuckDB GEOMETRY values are not WKB by default. Select ST_AsWKB(geom) AS geom or ST_AsText(geom) AS geom before passing the result to DeckJsonMap.',
      );
    }
    throw error instanceof Error ? error : new Error(message);
  }
}

function getSampleWKBGeomTypes(
  table: arrow.Table,
  columnName: string,
  sampleLimit = GEOMETRY_SAMPLE_LIMIT,
): number[] | null {
  const vector = table.getChild(columnName);
  if (!vector) return null;
  const geomTypes: number[] = [];
  for (let i = 0; i < table.numRows; i++) {
    const raw = vector.get(i);
    if (raw == null) continue;
    const hdr = parseWKBHeader(toArrayBuffer(raw));
    if (!hdr) return null;
    geomTypes.push(hdr.geomType);
    if (geomTypes.length >= sampleLimit) break;
  }
  return geomTypes;
}

function getSampleGeometryTypes(
  table: arrow.Table,
  columnName: string,
  encoding: ResolvedGeometryEncoding,
  sampleLimit = GEOMETRY_SAMPLE_LIMIT,
): string[] | null {
  const vector = table.getChild(columnName);
  if (!vector) return null;
  const geometryTypes: string[] = [];

  for (let i = 0; i < table.numRows; i++) {
    const geometry = parseGeometryValue(vector.get(i), encoding);
    if (!geometry) continue;
    geometryTypes.push(geometry.type);
    if (geometryTypes.length >= sampleLimit) break;
  }
  return geometryTypes;
}

function appendPolygonCoordinates(
  rings: number[][][],
  ringOffsetsList: number[],
  xyList: number[],
) {
  for (const ring of rings) {
    ringOffsetsList.push(xyList.length / 2);
    for (const point of ring) {
      xyList.push(point[0]!, point[1]!);
    }
  }
}

function sampledGeometriesMatch(
  table: arrow.Table,
  columnName: string,
  encoding: ResolvedGeometryEncoding,
  matchesParsedType: (geometryType: string) => boolean,
  matchesWKBType: (geometryType: number) => boolean,
) {
  try {
    const geometryTypes = getSampleGeometryTypes(table, columnName, encoding);
    return geometryTypes != null && geometryTypes.every(matchesParsedType);
  } catch {
    try {
      const geomTypes = getSampleWKBGeomTypes(table, columnName);
      return geomTypes != null && geomTypes.every(matchesWKBType);
    } catch {
      return false;
    }
  }
}

function tryPromotePolygonTable(
  table: arrow.Table,
  columnName: string,
  encoding: ResolvedGeometryEncoding,
): PreparedGeoArrowLayerData | null {
  const vector = table.getChild(columnName);
  if (!vector) return null;

  const n = table.numRows;
  const polygonOffsets = new Int32Array(n + 1);
  const ringOffsetsList: number[] = [];
  const xyList: number[] = [];
  const isNull = new Uint8Array(n);
  let nullCount = 0;
  const polygonVisitor = {
    onRingStart: () => ringOffsetsList.push(xyList.length / 2),
    onCoordinate: (x: number, y: number) => xyList.push(x, y),
  };

  for (let i = 0; i < n; i++) {
    polygonOffsets[i] = ringOffsetsList.length;
    const raw = vector.get(i);

    if (raw == null) {
      isNull[i] = 1;
      nullCount++;
      continue;
    }

    if (isWKTEncoding(encoding, raw)) {
      const geom = parseGeometryValue(raw, encoding);
      if (!geom) {
        isNull[i] = 1;
        nullCount++;
        continue;
      }
      if (geom.type === 'Polygon') {
        appendPolygonCoordinates(
          geom.coordinates as number[][][],
          ringOffsetsList,
          xyList,
        );
      } else if (geom.type === 'MultiPolygon') {
        for (const polygon of geom.coordinates as number[][][][]) {
          appendPolygonCoordinates(polygon, ringOffsetsList, xyList);
        }
      } else return null;
      continue;
    }

    const buf = toArrayBuffer(raw);
    const hdr = parseWKBHeader(buf);
    if (!hdr) return null;

    if (hdr.geomType === WKB_POLYGON) {
      if (visitWKBPolygonCoordinates(buf, hdr, polygonVisitor) == null) {
        return null;
      }
    } else if (hdr.geomType === WKB_MULTIPOLYGON) {
      if (!visitWKBMultiPolygonCoordinates(buf, hdr, polygonVisitor)) {
        return null;
      }
    } else return null;
  }
  polygonOffsets[n] = ringOffsetsList.length;

  const totalRings = ringOffsetsList.length;
  const totalPoints = xyList.length / 2;

  const ringOffsets = new Int32Array(totalRings + 1);
  for (let j = 0; j < totalRings; j++) ringOffsets[j] = ringOffsetsList[j]!;
  ringOffsets[totalRings] = totalPoints;

  const flatCoords = new Float64Array(xyList);
  const floatData = makeData({
    type: new Float64(),
    length: totalPoints * 2,
    data: flatCoords,
  });
  const pointData = makeData({
    type: VERTEX_TYPE,
    length: totalPoints,
    child: floatData,
  });
  const ringData = makeData({
    type: RING_TYPE,
    length: totalRings,
    valueOffsets: ringOffsets,
    child: pointData,
  });
  const polyData = makeData({
    type: POLYGON_TYPE,
    length: n,
    nullCount,
    nullBitmap: buildNullBitmap(n, isNull, nullCount),
    valueOffsets: polygonOffsets,
    child: ringData,
  });
  return buildPromotedResult(
    table,
    columnName,
    new Vector([polyData]),
    'geoarrow.polygon',
  );
}

/**
 * Attempt to promote WKB/WKT Point geometries into a native GeoArrow
 * FixedSizeList column. Returns `null` if any non-null geometry is not
 * a Point, so callers can fall back to the GeoJSON binary path.
 */
function tryPromotePointTable(
  table: arrow.Table,
  columnName: string,
  encoding: ResolvedGeometryEncoding,
): PreparedGeoArrowLayerData | null {
  const vector = table.getChild(columnName);
  if (!vector) return null;

  const n = table.numRows;
  const xyValues = new Float64Array(n * 2);
  const isNull = new Uint8Array(n);
  let nullCount = 0;

  const markNullPoint = (rowIndex: number) => {
    isNull[rowIndex] = 1;
    xyValues[rowIndex * 2] = Number.NaN;
    xyValues[rowIndex * 2 + 1] = Number.NaN;
    nullCount++;
  };

  for (let i = 0; i < n; i++) {
    const raw = vector.get(i);
    if (raw == null) {
      markNullPoint(i);
      continue;
    }

    if (isWKTEncoding(encoding, raw)) {
      const geom = parseGeometryValue(raw, encoding);
      if (!geom) {
        markNullPoint(i);
        continue;
      }
      if (geom.type !== 'Point') return null;
      const c = geom.coordinates as number[];
      xyValues[i * 2] = c[0]!;
      xyValues[i * 2 + 1] = c[1]!;
      continue;
    }

    const hdr = parseWKBHeader(toArrayBuffer(raw));
    if (!hdr) return null;
    const xy = readWKBPointXY(hdr);
    if (!xy) return null;
    xyValues[i * 2] = xy[0];
    xyValues[i * 2 + 1] = xy[1];
  }

  const floatData = makeData({
    type: new Float64(),
    length: n * 2,
    data: xyValues,
  });
  const geomData = makeData({
    type: VERTEX_TYPE,
    length: n,
    nullCount,
    nullBitmap: buildNullBitmap(n, isNull, nullCount),
    child: floatData,
  });
  return buildPromotedResult(
    table,
    columnName,
    new Vector([geomData]),
    'geoarrow.point',
  );
}

const POINT_LAYERS = new Set([
  'GeoArrowScatterplotLayer',
  'GeoArrowHeatmapLayer',
  'GeoArrowColumnLayer',
]);

const POLYGON_LAYERS = new Set([
  'GeoArrowPolygonLayer',
  'GeoArrowSolidPolygonLayer',
]);

const PATH_LAYERS = new Set(['GeoArrowPathLayer', 'GeoArrowTripsLayer']);

/**
 * Promotes WKB/WKT LineString geometries to a native GeoArrow LineString vector
 * (List<FixedSizeList<2, Float64>>). Returns null if any geometry is not a LineString.
 */
function tryPromoteLineStringTable(
  table: arrow.Table,
  columnName: string,
  encoding: ResolvedGeometryEncoding,
): PreparedGeoArrowLayerData | null {
  const vector = table.getChild(columnName);
  if (!vector) return null;

  const n = table.numRows;
  const allCoords: Float64Array[] = [];
  const offsets = new Int32Array(n + 1);
  const isNull = new Uint8Array(n);
  let nullCount = 0;
  let totalPoints = 0;

  for (let i = 0; i < n; i++) {
    offsets[i] = totalPoints;
    const raw = vector.get(i);
    if (raw == null) {
      isNull[i] = 1;
      nullCount++;
      continue;
    }

    let coords: Array<[number, number]> | null = null;

    if (isWKTEncoding(encoding, raw)) {
      const geom = parseGeometryValue(raw, encoding);
      if (!geom) {
        isNull[i] = 1;
        nullCount++;
        continue;
      }
      if (geom.type !== 'LineString') return null;
      coords = (geom.coordinates as number[][]).map(
        (c) => [c[0]!, c[1]!] as [number, number],
      );
    } else {
      const buf = toArrayBuffer(raw);
      const hdr = parseWKBHeader(buf);
      if (!hdr) return null;
      coords = readWKBLineStringXY(buf, hdr);
      if (!coords) return null;
    }

    const flat = new Float64Array(coords.length * 2);
    for (let j = 0; j < coords.length; j++) {
      flat[j * 2] = coords[j]![0];
      flat[j * 2 + 1] = coords[j]![1];
    }
    allCoords.push(flat);
    totalPoints += coords.length;
  }
  offsets[n] = totalPoints;

  const flatValues = new Float64Array(totalPoints * 2);
  let writeOffset = 0;
  for (const chunk of allCoords) {
    flatValues.set(chunk, writeOffset);
    writeOffset += chunk.length;
  }

  const floatData = makeData({
    type: new Float64(),
    length: totalPoints * 2,
    data: flatValues,
  });
  const vertexData = makeData({
    type: VERTEX_TYPE,
    length: totalPoints,
    child: floatData,
  });
  const lineStringType = new List(VERTEX_FIELD);
  const lineData = makeData({
    type: lineStringType,
    length: n,
    nullCount,
    nullBitmap: buildNullBitmap(n, isNull, nullCount),
    valueOffsets: offsets,
    child: vertexData,
  });

  return buildPromotedResult(
    table,
    columnName,
    new Vector([lineData]),
    'geoarrow.linestring',
  );
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

    if (POINT_LAYERS.has(layerType)) {
      return sampledGeometriesMatch(
        table,
        columnName,
        encoding,
        (geometryType) => geometryType === 'Point',
        (geometryType) => geometryType === WKB_POINT,
      );
    }

    if (POLYGON_LAYERS.has(layerType)) {
      return sampledGeometriesMatch(
        table,
        columnName,
        encoding,
        (geometryType) =>
          geometryType === 'Polygon' || geometryType === 'MultiPolygon',
        (geometryType) =>
          geometryType === WKB_POLYGON || geometryType === WKB_MULTIPOLYGON,
      );
    }

    if (PATH_LAYERS.has(layerType)) {
      return sampledGeometriesMatch(
        table,
        columnName,
        encoding,
        (geometryType) => geometryType === 'LineString',
        (geometryType) => geometryType === WKB_LINESTRING,
      );
    }

    return false;
  },

  toGeoArrowLike(
    table: arrow.Table,
    columnName: string,
    encoding: ResolvedGeometryEncoding,
  ) {
    const pointResult = tryPromotePointTable(table, columnName, encoding);
    if (pointResult) return pointResult;

    const lineResult = tryPromoteLineStringTable(table, columnName, encoding);
    if (lineResult) return lineResult;

    const result = tryPromotePolygonTable(table, columnName, encoding);
    if (result) return result;

    throw new Error(
      'GeoArrow promotion failed: unsupported geometry type for column.',
    );
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
