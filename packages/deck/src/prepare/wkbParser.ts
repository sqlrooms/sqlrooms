export const WKB_POINT = 1;
export const WKB_POLYGON = 3;
export const WKB_MULTIPOLYGON = 6;

// Local WKB parser used until geoarrow-js ships WKB to GeoArrow parsing:
// See: https://github.com/geoarrow/geoarrow-js/issues/54
const WKB_BYTE_ORDER_BYTES = 1;
const WKB_GEOMETRY_TYPE_BYTES = 4;
const WKB_HEADER_BYTES = WKB_BYTE_ORDER_BYTES + WKB_GEOMETRY_TYPE_BYTES;
const WKB_GEOMETRY_TYPE_OFFSET = WKB_BYTE_ORDER_BYTES;
const WKB_SRID_BYTES = 4;
const WKB_UINT32_BYTES = 4;
const XY_COORDINATE_BYTES = 16;
const OPTIONAL_COORDINATE_DIMENSION_BYTES = 8;
const Y_COORDINATE_OFFSET_BYTES = 8;

// PostGIS EWKB stores Z/M/SRID metadata in the high bits
// of the WKB type word.
const EWKB_Z_FLAG = 0x80000000;
const EWKB_M_FLAG = 0x40000000;
const EWKB_SRID_FLAG = 0x20000000;
const ISO_WKB_TYPE_MASK = 0xffff;
const ISO_WKB_Z_OFFSET = 1000;
const ISO_WKB_M_OFFSET = 2000;
const ISO_WKB_ZM_OFFSET = 3000;
const ISO_WKB_MAX_BASE_TYPE = 7;

export type WKBHeader = {
  view: DataView;
  isLE: boolean;
  geomType: number;
  offset: number;
  coordBytes: number;
};

export type WKBPolygonCoordinateVisitor = {
  onRingStart: () => void;
  onCoordinate: (x: number, y: number) => void;
};

// Reads the shared WKB/EWKB prefix like byte order, geometry type, optional SRID
// and bytes per coordinate. Point/polygon readers use this to find their data.
export function parseWKBHeader(
  buf: ArrayBuffer,
  startOffset = 0,
): WKBHeader | null {
  if (buf.byteLength < startOffset + WKB_HEADER_BYTES) return null;
  const view = new DataView(buf);
  const isLE = view.getUint8(startOffset) === 1;
  const rawType = view.getUint32(startOffset + WKB_GEOMETRY_TYPE_OFFSET, isLE);
  const isoType = rawType & ISO_WKB_TYPE_MASK;
  const isoZ = hasIsoWKBTypeOffset(isoType, ISO_WKB_Z_OFFSET);
  const isoM = hasIsoWKBTypeOffset(isoType, ISO_WKB_M_OFFSET);
  const isoZM = hasIsoWKBTypeOffset(isoType, ISO_WKB_ZM_OFFSET);

  const hasZ = (rawType & EWKB_Z_FLAG) !== 0 || isoZ || isoZM;
  const hasM = (rawType & EWKB_M_FLAG) !== 0 || isoM || isoZM;
  const hasSRID = (rawType & EWKB_SRID_FLAG) !== 0;

  let base = isoType;
  if (isoZM) base -= ISO_WKB_ZM_OFFSET;
  else if (isoM) base -= ISO_WKB_M_OFFSET;
  else if (isoZ) base -= ISO_WKB_Z_OFFSET;

  let offset = startOffset + WKB_HEADER_BYTES;
  if (hasSRID) offset += WKB_SRID_BYTES;

  const coordBytes =
    XY_COORDINATE_BYTES +
    (hasZ ? OPTIONAL_COORDINATE_DIMENSION_BYTES : 0) +
    (hasM ? OPTIONAL_COORDINATE_DIMENSION_BYTES : 0);
  return {view, isLE, geomType: base, offset, coordBytes};
}

export function readWKBPointXY(header: WKBHeader): [number, number] | null {
  if (header.geomType !== WKB_POINT) return null;
  if (!hasBytes(header.view.buffer, header.offset, header.coordBytes)) {
    return null;
  }
  return [
    header.view.getFloat64(header.offset, header.isLE),
    header.view.getFloat64(
      header.offset + Y_COORDINATE_OFFSET_BYTES,
      header.isLE,
    ),
  ];
}

export function visitWKBPolygonCoordinates(
  buf: ArrayBuffer,
  header: WKBHeader,
  visitor: WKBPolygonCoordinateVisitor,
): number | null {
  if (header.geomType !== WKB_POLYGON) return null;

  const {view, isLE, offset: headerOffset, coordBytes} = header;
  let offset = headerOffset;
  if (!hasBytes(buf, offset, WKB_UINT32_BYTES)) return null;
  const numRings = view.getUint32(offset, isLE);
  offset += WKB_UINT32_BYTES;

  for (let ringIndex = 0; ringIndex < numRings; ringIndex++) {
    visitor.onRingStart();
    if (!hasBytes(buf, offset, WKB_UINT32_BYTES)) return null;
    const numPoints = view.getUint32(offset, isLE);
    offset += WKB_UINT32_BYTES;
    for (let pointIndex = 0; pointIndex < numPoints; pointIndex++) {
      if (!hasBytes(buf, offset, coordBytes)) return null;
      visitor.onCoordinate(
        view.getFloat64(offset, isLE),
        view.getFloat64(offset + Y_COORDINATE_OFFSET_BYTES, isLE),
      );
      offset += coordBytes;
    }
  }

  return offset <= buf.byteLength ? offset : null;
}

export function visitWKBMultiPolygonCoordinates(
  buf: ArrayBuffer,
  header: WKBHeader,
  visitor: WKBPolygonCoordinateVisitor,
): boolean {
  if (header.geomType !== WKB_MULTIPOLYGON) return false;

  let offset = header.offset;
  if (!hasBytes(buf, offset, WKB_UINT32_BYTES)) return false;
  const numPolygons = header.view.getUint32(offset, header.isLE);
  offset += WKB_UINT32_BYTES;

  for (let polygonIndex = 0; polygonIndex < numPolygons; polygonIndex++) {
    const polygonHeader = parseWKBHeader(buf, offset);
    if (!polygonHeader || polygonHeader.geomType !== WKB_POLYGON) return false;
    const nextOffset = visitWKBPolygonCoordinates(buf, polygonHeader, visitor);
    if (nextOffset == null) return false;
    offset = nextOffset;
  }

  return offset <= buf.byteLength;
}

function hasIsoWKBTypeOffset(isoType: number, offset: number): boolean {
  return isoType >= offset && isoType <= offset + ISO_WKB_MAX_BASE_TYPE;
}

function hasBytes(
  buf: {byteLength: number},
  offset: number,
  byteLength: number,
) {
  return offset >= 0 && offset + byteLength <= buf.byteLength;
}
