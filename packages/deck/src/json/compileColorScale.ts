import {
  buildColorScaleLegend as buildGenericColorScaleLegend,
  coerceFiniteNumber,
  createColorScaleMapper,
  type ColorScaleConfig,
  type ResolvedColorLegend,
} from '@sqlrooms/color-scales';
import type * as arrow from 'apache-arrow';

function resolveFieldName(
  schemaOwner: arrow.Table | arrow.RecordBatch,
  requestedField: string,
) {
  const exactMatch = schemaOwner.schema.fields.find(
    (field) => field.name === requestedField,
  )?.name;
  if (exactMatch) {
    return exactMatch;
  }

  const caseInsensitiveMatches = schemaOwner.schema.fields
    .map((field) => field.name)
    .filter(
      (fieldName) => fieldName.toLowerCase() === requestedField.toLowerCase(),
    );

  if (caseInsensitiveMatches.length === 1) {
    return caseInsensitiveMatches[0]!;
  }

  return undefined;
}

function getColumn(table: arrow.Table, field: string) {
  const resolvedFieldName = resolveFieldName(table, field);
  if (!resolvedFieldName) {
    throw new Error(`Unknown colorScale field "${field}".`);
  }

  const vector = table.getChild(resolvedFieldName);
  if (!vector) {
    throw new Error(`Unable to read colorScale field "${resolvedFieldName}".`);
  }

  return {
    fieldName: resolvedFieldName,
    vector,
  };
}

function getRowValue(row: unknown, fieldName: string) {
  if (!row || typeof row !== 'object') {
    return undefined;
  }

  const object = row as Record<string, unknown>;
  const sources = [
    object,
    object.properties as Record<string, unknown> | undefined,
  ].filter((value): value is Record<string, unknown> =>
    Boolean(value && typeof value === 'object'),
  );

  for (const source of sources) {
    if (fieldName in source) {
      return source[fieldName];
    }

    const caseInsensitiveMatches = Object.keys(source).filter(
      (key) => key.toLowerCase() === fieldName.toLowerCase(),
    );
    if (caseInsensitiveMatches.length === 1) {
      return source[caseInsensitiveMatches[0]!] as unknown;
    }
  }

  return undefined;
}

function getGeoArrowOrRowValue(options: {
  value: unknown;
  fieldName: string;
  vector: arrow.Vector;
}) {
  const {value, fieldName, vector} = options;
  if (
    value &&
    typeof value === 'object' &&
    'index' in value &&
    typeof (value as {index?: unknown}).index === 'number'
  ) {
    const objectInfo = value as {
      index: number;
      data?: {data?: arrow.Table | arrow.RecordBatch};
    };
    const batch = objectInfo.data?.data;
    const batchFieldName = batch
      ? resolveFieldName(batch, fieldName)
      : undefined;

    if (batch && batchFieldName) {
      return batch.getChild(batchFieldName)?.get(objectInfo.index);
    }

    return vector.get(objectInfo.index);
  }

  return getRowValue(value, fieldName);
}

function getColumnValues(vector: arrow.Vector) {
  return Array.from({length: vector.length}, (_, index) => vector.get(index));
}

export function compileColorScale(options: {
  table: arrow.Table;
  colorScale: ColorScaleConfig;
}) {
  const {table, colorScale} = options;
  const {fieldName, vector} = getColumn(table, colorScale.field);
  const mapper = createColorScaleMapper({
    colorScale,
    values: getColumnValues(vector),
  });

  return (value: unknown) =>
    mapper(getGeoArrowOrRowValue({value, fieldName, vector}));
}

export function buildColorScaleLegend(options: {
  table: arrow.Table;
  colorScale: ColorScaleConfig;
  title?: string;
}): ResolvedColorLegend | null {
  const {table, colorScale} = options;
  const {vector} = getColumn(table, colorScale.field);
  const values = getColumnValues(vector);

  if (
    colorScale.type !== 'categorical' &&
    values.every((value) => coerceFiniteNumber(value) === undefined)
  ) {
    return null;
  }

  return buildGenericColorScaleLegend({
    colorScale,
    values,
    title: options.title,
  });
}
