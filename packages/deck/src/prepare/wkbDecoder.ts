import {
  Field,
  FixedSizeList,
  Float64,
  List,
  makeData,
  Table,
  Vector,
} from 'apache-arrow';
import type * as arrow from 'apache-arrow';
import {WKBLoader, WKTLoader} from '@loaders.gl/wkt';
import type {GeometryDecoder} from './geometryDecoder';
import type {
  PreparedGeoArrowLayerData,
  ResolvedGeometryEncoding,
} from './types';
import {buildBinaryGeoJsonData} from './toGeoJsonBinary';

const COORD_FIELD = new Field('xy', new Float64(), false);
const VERTEX_TYPE = new FixedSizeList(2, COORD_FIELD);
const VERTEX_FIELD = new Field('', VERTEX_TYPE, true);
const RING_TYPE = new List(VERTEX_FIELD);
const RING_FIELD = new Field('', RING_TYPE, true);
const POLYGON_TYPE = new List(RING_FIELD);

const WKB_POINT = 1;
const WKB_POLYGON = 3;

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

type WKBHeader = {
  view: DataView;
  isLE: boolean;
  geomType: number;
  offset: number;
  coordBytes: number;
};

function parseWKBHeader(buf: ArrayBuffer): WKBHeader | null {
  if (buf.byteLength < 5) return null;
  const view = new DataView(buf);
  const isLE = view.getUint8(0) === 1;
  const rawType = view.getUint32(1, isLE);

  const hasZ =
    (rawType & 0x80000000) !== 0 ||
    ((rawType & 0xffff) > 1000 && (rawType & 0xffff) <= 1007);
  const hasM =
    (rawType & 0x40000000) !== 0 ||
    ((rawType & 0xffff) > 2000 && (rawType & 0xffff) <= 2007);
  const hasSRID = (rawType & 0x20000000) !== 0;

  let base = rawType & 0xffff;
  if (base > 2000) base -= 2000;
  else if (base > 1000) base -= 1000;

  let offset = 5;
  if (hasSRID) offset += 4;

  const coordBytes = 16 + (hasZ ? 8 : 0) + (hasM ? 8 : 0);
  return {view, isLE, geomType: base, offset, coordBytes};
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
  const bitmap = new Uint8Array(Math.ceil(n / 8));
  for (let i = 0; i < n; i++) {
    if (isNull[i] !== 1)
      bitmap[i >> 3] = (bitmap[i >> 3] ?? 0) | (1 << (i & 7));
  }
  return bitmap;
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

function getSampleWKBGeomType(
  table: arrow.Table,
  columnName: string,
): number | null {
  const vector = table.getChild(columnName);
  if (!vector) return null;
  for (let i = 0; i < table.numRows; i++) {
    const raw = vector.get(i);
    if (raw == null) continue;
    const hdr = parseWKBHeader(toArrayBuffer(raw));
    if (hdr) return hdr.geomType;
  }
  return null;
}

function getSampleGeometry(
  table: arrow.Table,
  columnName: string,
  encoding: ResolvedGeometryEncoding,
) {
  const vector = table.getChild(columnName);
  if (!vector) return null;

  for (let i = 0; i < table.numRows; i++) {
    const geometry = parseGeometryValue(vector.get(i), encoding);
    if (geometry) return geometry;
  }
  return null;
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
        for (const ring of geom.coordinates as number[][][]) {
          ringOffsetsList.push(xyList.length / 2);
          for (const p of ring) {
            xyList.push(p[0]!, p[1]!);
          }
        }
      } else return null;
      continue;
    }

    const hdr = parseWKBHeader(toArrayBuffer(raw));
    if (!hdr) return null;

    const {view, isLE, geomType, offset: hdrOff, coordBytes} = hdr;
    let off = hdrOff;

    if (geomType === WKB_POLYGON) {
      const numRings = view.getUint32(off, isLE);
      off += 4;
      for (let r = 0; r < numRings; r++) {
        ringOffsetsList.push(xyList.length / 2);
        const numPts = view.getUint32(off, isLE);
        off += 4;
        for (let p = 0; p < numPts; p++) {
          xyList.push(
            view.getFloat64(off, isLE),
            view.getFloat64(off + 8, isLE),
          );
          off += coordBytes;
        }
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

  for (let i = 0; i < n; i++) {
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
      if (geom.type !== 'Point') return null;
      const c = geom.coordinates as number[];
      xyValues[i * 2] = c[0]!;
      xyValues[i * 2 + 1] = c[1]!;
      continue;
    }

    const hdr = parseWKBHeader(toArrayBuffer(raw));
    if (!hdr || hdr.geomType !== WKB_POINT) return null;
    xyValues[i * 2] = hdr.view.getFloat64(hdr.offset, hdr.isLE);
    xyValues[i * 2 + 1] = hdr.view.getFloat64(hdr.offset + 8, hdr.isLE);
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
      try {
        const s = getSampleGeometry(table, columnName, encoding);
        return s == null || s.type === 'Point';
      } catch {
        const t = getSampleWKBGeomType(table, columnName);
        return t == null || t === WKB_POINT;
      }
    }

    if (POLYGON_LAYERS.has(layerType)) {
      try {
        const s = getSampleGeometry(table, columnName, encoding);
        return s == null || s.type === 'Polygon';
      } catch {
        const t = getSampleWKBGeomType(table, columnName);
        return t == null || t === WKB_POLYGON;
      }
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
