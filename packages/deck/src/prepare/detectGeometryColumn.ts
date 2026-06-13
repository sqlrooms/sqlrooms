import {
  getGeoMetadata,
  getGeometryColumnsFromSchema,
} from '@loaders.gl/geoarrow';
import * as arrow from 'apache-arrow';
import {isDirectGeoArrowEncoding} from './geoarrow';
import {synthesizePointVector} from './synthesizePointVector';
import type {
  GeometryEncodingHint,
  ResolvedGeometryColumn,
  ResolvedGeometryEncoding,
} from './types';

type DetectGeometryColumnOptions = {
  table: arrow.Table;
  geometryColumn?: string;
  geometryEncodingHint?: GeometryEncodingHint;
};

const LON_NAMES = new Set([
  'longitude',
  'lon',
  'lng',
  'long',
  'source_lon',
  'target_lon',
]);
const LAT_NAMES = new Set(['latitude', 'lat', 'source_lat', 'target_lat']);

function getFieldNames(table: arrow.Table) {
  return table.schema.fields.map((field) => field.name);
}

/**
 * Detects longitude/latitude columns in an Arrow table by matching
 * field names against known patterns (case-insensitive).
 * Returns the original field names if found, or null.
 */
export function findCoordinateColumns(
  table: arrow.Table,
): {lonField: string; latField: string} | null {
  const fields = table.schema.fields;
  let lonField: string | undefined;
  let latField: string | undefined;
  for (const field of fields) {
    const lower = field.name.toLowerCase();
    if (!lonField && LON_NAMES.has(lower)) lonField = field.name;
    if (!latField && LAT_NAMES.has(lower)) latField = field.name;
  }
  return lonField && latField ? {lonField, latField} : null;
}

function synthesizeGeoArrowPointColumn(
  table: arrow.Table,
  lonField: string,
  latField: string,
): {vector: arrow.Vector; encoding: ResolvedGeometryEncoding} {
  const lonVector = table.getChild(lonField);
  const latVector = table.getChild(latField);
  if (!lonVector || !latVector) {
    throw new Error(
      `Could not access coordinate columns "${lonField}" / "${latField}".`,
    );
  }

  return {
    vector: synthesizePointVector(lonVector, latVector, table.numRows),
    encoding: 'geoarrow.point' as ResolvedGeometryEncoding,
  };
}

const KNOWN_GEOM_NAMES = ['geometry', 'geom', 'wkb_geometry', 'the_geom'];

function getFieldVector(table: arrow.Table, fieldName: string) {
  const vector = table.getChild(fieldName);
  if (vector) {
    return {vector, synthesized: false as const};
  }

  // Fallback: if the requested geometry column doesn't exist, try other common names
  if (KNOWN_GEOM_NAMES.includes(fieldName.toLowerCase())) {
    for (const altName of KNOWN_GEOM_NAMES) {
      if (altName.toLowerCase() === fieldName.toLowerCase()) continue;
      const altVector = table.getChild(altName);
      if (altVector) {
        return {vector: altVector, synthesized: false as const};
      }
    }
  }

  // Fallback: if the geometry column doesn't exist but the table has
  // recognizable longitude/latitude columns, synthesize GeoArrow point geometry.
  const coords = findCoordinateColumns(table);
  if (coords) {
    const result = synthesizeGeoArrowPointColumn(
      table,
      coords.lonField,
      coords.latField,
    );
    return {
      vector: result.vector,
      synthesized: true as const,
      encoding: result.encoding,
    };
  }

  const available = table.schema.fields.map((f) => f.name).join(', ');
  throw new Error(
    `Geometry column "${fieldName}" was not found in the Arrow table. Available columns: ${available}. ` +
      `If the data has longitude/latitude columns, the dataset source SQL should create the geometry column ` +
      `(e.g. ST_AsWKB(ST_Point(longitude, latitude)) AS "${fieldName}").`,
  );
}

function normalizeEncoding(
  encoding: string | undefined,
): ResolvedGeometryEncoding | undefined {
  if (!encoding) {
    return undefined;
  }

  const normalized = encoding.toLowerCase() as ResolvedGeometryEncoding;
  switch (normalized) {
    case 'geoarrow.point':
    case 'geoarrow.multipoint':
    case 'geoarrow.linestring':
    case 'geoarrow.multilinestring':
    case 'geoarrow.polygon':
    case 'geoarrow.multipolygon':
    case 'geoarrow.wkb':
    case 'geoarrow.wkt':
    case 'wkb':
    case 'wkt':
      return normalized;
    default:
      return undefined;
  }
}

function inferEncodingFromHint(
  hint: GeometryEncodingHint | undefined,
): ResolvedGeometryEncoding | undefined {
  switch (hint) {
    case 'wkb':
      return 'wkb';
    case 'wkt':
      return 'wkt';
    default:
      return undefined;
  }
}

function inferEncodingFromVector(
  vector: arrow.Vector,
): ResolvedGeometryEncoding {
  const typeName = String(vector.type).toLowerCase();
  if (typeName.includes('utf')) {
    return 'wkt';
  }
  if (typeName.includes('binary')) {
    return 'wkb';
  }
  return 'unknown';
}

export function detectGeometryColumn(
  options: DetectGeometryColumnOptions,
): ResolvedGeometryColumn {
  const {table, geometryColumn, geometryEncodingHint} = options;
  const fieldNames = getFieldNames(table);
  const fieldMetadata = getGeometryColumnsFromSchema(table.schema as never);
  const geoMetadata = getGeoMetadata(table.schema as never);
  const metadataCandidates = new Set<string>([
    ...Object.keys(fieldMetadata),
    ...Object.keys(geoMetadata?.columns ?? {}),
  ]);

  const namedCandidates = fieldNames.filter((fieldName) =>
    /^(geom|geometry)$/i.test(fieldName),
  );

  const explicitGeometryColumn = geometryColumn;
  const detectedGeometryColumn =
    explicitGeometryColumn ??
    (metadataCandidates.size === 1 ? [...metadataCandidates][0] : undefined) ??
    (namedCandidates.length === 1 ? namedCandidates[0] : undefined);

  if (!detectedGeometryColumn) {
    throw new Error(
      `Could not detect a geometry column. Available columns: ${fieldNames.join(', ')}`,
    );
  }

  const fieldResult = getFieldVector(table, detectedGeometryColumn);

  // When geometry was synthesized from lon/lat columns, use the encoding
  // determined during synthesis (geoarrow.point) instead of inferring from hints.
  if (fieldResult.synthesized) {
    return {
      columnName: detectedGeometryColumn,
      vector: fieldResult.vector,
      encoding: fieldResult.encoding,
      nativeGeoArrow: isDirectGeoArrowEncoding(fieldResult.encoding),
    };
  }

  const metadataEncoding =
    normalizeEncoding(fieldMetadata[detectedGeometryColumn]?.encoding) ??
    normalizeEncoding(geoMetadata?.columns?.[detectedGeometryColumn]?.encoding);

  const encoding =
    inferEncodingFromHint(geometryEncodingHint) ??
    metadataEncoding ??
    inferEncodingFromVector(fieldResult.vector);

  return {
    columnName: detectedGeometryColumn,
    vector: fieldResult.vector,
    encoding,
    nativeGeoArrow: isDirectGeoArrowEncoding(encoding),
  };
}
