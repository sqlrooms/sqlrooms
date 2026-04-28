import {
  getGeoMetadata,
  getGeometryColumnsFromSchema,
} from '@loaders.gl/geoarrow';
import type * as arrow from 'apache-arrow';
import type {
  GeometryEncodingHint,
  ResolvedGeometryColumn,
  ResolvedGeometryEncoding,
} from './types';
import {isDirectGeoArrowEncoding} from './geoarrow';

type DetectGeometryColumnOptions = {
  table: arrow.Table;
  geometryColumn?: string;
  geometryEncodingHint?: GeometryEncodingHint;
};

function getFieldNames(table: arrow.Table) {
  return table.schema.fields.map((field) => field.name);
}

function getFieldVector(table: arrow.Table, fieldName: string) {
  const vector = table.getChild(fieldName);
  if (!vector) {
    throw new Error(
      `Geometry column "${fieldName}" was not found in the Arrow table.`,
    );
  }
  return vector;
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

  const vector = getFieldVector(table, detectedGeometryColumn);
  const metadataEncoding =
    normalizeEncoding(fieldMetadata[detectedGeometryColumn]?.encoding) ??
    normalizeEncoding(geoMetadata?.columns?.[detectedGeometryColumn]?.encoding);

  const encoding =
    inferEncodingFromHint(geometryEncodingHint) ??
    metadataEncoding ??
    inferEncodingFromVector(vector);

  return {
    columnName: detectedGeometryColumn,
    vector,
    encoding,
    nativeGeoArrow: isDirectGeoArrowEncoding(encoding),
  };
}
