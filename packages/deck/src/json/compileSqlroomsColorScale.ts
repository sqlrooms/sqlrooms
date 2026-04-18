import type * as arrow from 'apache-arrow';
import {rgb} from 'd3-color';
import {scaleDiverging, scaleOrdinal, scaleSequential} from 'd3-scale';
import {
  interpolateBlues,
  interpolateBrBG,
  interpolateCividis,
  interpolatePlasma,
  interpolateRdBu,
  interpolateSpectral,
  interpolateViridis,
  interpolateYlOrRd,
  schemeAccent,
  schemeSet2,
  schemeTableau10,
} from 'd3-scale-chromatic';
import type {SqlroomsColorScale} from '../types';

const DEFAULT_NULL_COLOR: [number, number, number, number] = [0, 0, 0, 0];
const DEFAULT_UNKNOWN_COLOR: [number, number, number, number] = [
  180, 180, 180, 180,
];

const SEQUENTIAL_SCHEMES = {
  Viridis: interpolateViridis,
  Plasma: interpolatePlasma,
  Cividis: interpolateCividis,
  YlOrRd: interpolateYlOrRd,
  Blues: interpolateBlues,
} as const;

const DIVERGING_SCHEMES = {
  RdBu: interpolateRdBu,
  BrBG: interpolateBrBG,
  Spectral: interpolateSpectral,
} as const;

const CATEGORICAL_SCHEMES = {
  Tableau10: schemeTableau10,
  Set2: schemeSet2,
  Accent: schemeAccent,
} as const;

function normalizeColor(
  color: [number, number, number, number?] | undefined,
  fallback: [number, number, number, number],
) {
  if (!color) {
    return fallback;
  }

  return [color[0], color[1], color[2], color[3] ?? 255] as [
    number,
    number,
    number,
    number,
  ];
}

function parseColorString(value: string, alpha = 255) {
  const parsed = rgb(value);
  return [parsed.r, parsed.g, parsed.b, alpha] as [
    number,
    number,
    number,
    number,
  ];
}

function resolveFieldName(table: arrow.Table, requestedField: string) {
  const exactMatch = table.schema.fields.find(
    (field) => field.name === requestedField,
  )?.name;
  if (exactMatch) {
    return exactMatch;
  }

  const caseInsensitiveMatches = table.schema.fields
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

function toFiniteNumber(value: unknown) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === 'bigint') {
    return Number(value);
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function getNumericValues(vector: arrow.Vector) {
  const values: number[] = [];
  for (let index = 0; index < vector.length; index += 1) {
    const numericValue = toFiniteNumber(vector.get(index));
    if (numericValue !== undefined) {
      values.push(numericValue);
    }
  }

  return values;
}

function getSequentialDomain(values: number[]) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    return [min - 1, max + 1] as [number, number];
  }

  return [min, max] as [number, number];
}

function getDivergingDomain(values: number[]) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    return [min - 1, min, max + 1] as [number, number, number];
  }

  if (min < 0 && max > 0) {
    return [min, 0, max] as [number, number, number];
  }

  return [min, (min + max) / 2, max] as [number, number, number];
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
    return vector.get((value as {index: number}).index);
  }

  return getRowValue(value, fieldName);
}

export function compileSqlroomsColorScale(options: {
  table: arrow.Table;
  colorScale: SqlroomsColorScale;
}) {
  const {table, colorScale} = options;
  const {fieldName, vector} = getColumn(table, colorScale.field);
  const nullColor = normalizeColor(colorScale.nullColor, DEFAULT_NULL_COLOR);

  if (colorScale.type === 'categorical') {
    const baseRange = CATEGORICAL_SCHEMES[colorScale.scheme];
    if (!baseRange) {
      throw new Error(
        `Unsupported categorical colorScale scheme "${colorScale.scheme}".`,
      );
    }

    const range = colorScale.reverse
      ? [...baseRange].reverse()
      : [...baseRange];
    const scale = scaleOrdinal<string, string>(range);
    const unknownColor = normalizeColor(
      colorScale.unknownColor,
      DEFAULT_UNKNOWN_COLOR,
    );

    return (value: unknown) => {
      const rawValue = getGeoArrowOrRowValue({value, fieldName, vector});
      if (rawValue == null) {
        return nullColor;
      }

      if (
        typeof rawValue !== 'string' &&
        typeof rawValue !== 'number' &&
        typeof rawValue !== 'boolean'
      ) {
        return unknownColor;
      }

      return parseColorString(scale(String(rawValue)));
    };
  }

  const numericValues = getNumericValues(vector);
  if (numericValues.length === 0) {
    throw new Error(
      `colorScale field "${fieldName}" does not contain any numeric values.`,
    );
  }

  if (colorScale.type === 'sequential') {
    const interpolator = SEQUENTIAL_SCHEMES[colorScale.scheme];
    if (!interpolator) {
      throw new Error(
        `Unsupported sequential colorScale scheme "${colorScale.scheme}".`,
      );
    }

    const domain =
      colorScale.domain === 'auto'
        ? getSequentialDomain(numericValues)
        : colorScale.domain;
    const baseInterpolator = colorScale.reverse
      ? (t: number) => interpolator(1 - t)
      : interpolator;
    const scale = scaleSequential(baseInterpolator).domain(domain);
    if (colorScale.clamp) {
      scale.clamp(true);
    }

    return (value: unknown) => {
      const rawValue = getGeoArrowOrRowValue({value, fieldName, vector});
      const numericValue = toFiniteNumber(rawValue);
      if (numericValue === undefined) {
        return nullColor;
      }

      return parseColorString(scale(numericValue));
    };
  }

  const interpolator = DIVERGING_SCHEMES[colorScale.scheme];
  if (!interpolator) {
    throw new Error(
      `Unsupported diverging colorScale scheme "${colorScale.scheme}".`,
    );
  }

  const domain =
    colorScale.domain === 'auto'
      ? getDivergingDomain(numericValues)
      : colorScale.domain;
  const baseInterpolator = colorScale.reverse
    ? (t: number) => interpolator(1 - t)
    : interpolator;
  const scale = scaleDiverging(baseInterpolator).domain(domain);
  if (colorScale.clamp) {
    scale.clamp(true);
  }

  return (value: unknown) => {
    const rawValue = getGeoArrowOrRowValue({value, fieldName, vector});
    const numericValue = toFiniteNumber(rawValue);
    if (numericValue === undefined) {
      return nullColor;
    }

    return parseColorString(scale(numericValue));
  };
}
