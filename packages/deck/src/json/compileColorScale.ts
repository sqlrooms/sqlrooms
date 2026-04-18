import type * as arrow from 'apache-arrow';
import {rgb} from 'd3-color';
import {scaleDiverging, scaleOrdinal, scaleSequential} from 'd3-scale';
import {
  interpolateBlues,
  interpolateBrBG,
  interpolateBuGn,
  interpolateBuPu,
  interpolateCividis,
  interpolateCool,
  interpolateCubehelixDefault,
  interpolateGnBu,
  interpolateGreens,
  interpolateGreys,
  interpolateInferno,
  interpolateMagma,
  interpolateOranges,
  interpolateOrRd,
  interpolatePlasma,
  interpolatePuBu,
  interpolatePuBuGn,
  interpolatePuRd,
  interpolatePurples,
  interpolateRdBu,
  interpolateRdPu,
  interpolateReds,
  interpolateSpectral,
  interpolateTurbo,
  interpolateViridis,
  interpolateWarm,
  interpolateYlGn,
  interpolateYlGnBu,
  interpolateYlOrBr,
  interpolateYlOrRd,
  schemeAccent,
  schemeSet2,
  schemeTableau10,
} from 'd3-scale-chromatic';
import type {LayerColorScale} from '../types';

const DEFAULT_NULL_COLOR: [number, number, number, number] = [0, 0, 0, 0];
const DEFAULT_UNKNOWN_COLOR: [number, number, number, number] = [
  180, 180, 180, 180,
];

// https://d3js.org/d3-scale-chromatic/sequential
const SEQUENTIAL_SCHEMES = {
  Blues: interpolateBlues,
  Greens: interpolateGreens,
  Greys: interpolateGreys,
  Oranges: interpolateOranges,
  Purples: interpolatePurples,
  Reds: interpolateReds,
  Turbo: interpolateTurbo,
  Viridis: interpolateViridis,
  Inferno: interpolateInferno,
  Magma: interpolateMagma,
  Plasma: interpolatePlasma,
  Cividis: interpolateCividis,
  Warm: interpolateWarm,
  Cool: interpolateCool,
  CubehelixDefault: interpolateCubehelixDefault,
  BuGn: interpolateBuGn,
  BuPu: interpolateBuPu,
  GnBu: interpolateGnBu,
  OrRd: interpolateOrRd,
  PuBuGn: interpolatePuBuGn,
  PuBu: interpolatePuBu,
  PuRd: interpolatePuRd,
  RdPu: interpolateRdPu,
  YlGnBu: interpolateYlGnBu,
  YlGn: interpolateYlGn,
  YlOrBr: interpolateYlOrBr,
  YlOrRd: interpolateYlOrRd,
} as const;

// https://d3js.org/d3-scale-chromatic/diverging
const DIVERGING_SCHEMES = {
  RdBu: interpolateRdBu,
  BrBG: interpolateBrBG,
  Spectral: interpolateSpectral,
} as const;

// https://d3js.org/d3-scale-chromatic/categorical
const CATEGORICAL_SCHEMES = {
  Tableau10: schemeTableau10,
  Set2: schemeSet2,
  Accent: schemeAccent,
} as const;

export type ResolvedColorLegend =
  | {
      type: 'continuous';
      title: string;
      gradient: string;
      ticks: Array<{label: string; offset: number}>;
    }
  | {
      type: 'categorical';
      title: string;
      items: Array<{label: string; color: [number, number, number, number]}>;
    };

function createNullColorAccessor(nullColor: [number, number, number, number]) {
  return () => nullColor;
}

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

function toRgbaString(color: [number, number, number, number]) {
  return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3] / 255})`;
}

function formatLegendNumber(value: number) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: Math.abs(value) >= 100 ? 0 : 2,
  }).format(value);
}

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

function unique<T>(values: T[]) {
  return [...new Set(values)];
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

export function compileColorScale(options: {
  table: arrow.Table;
  colorScale: LayerColorScale;
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
    return createNullColorAccessor(nullColor);
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

export function buildColorScaleLegend(options: {
  table: arrow.Table;
  colorScale: LayerColorScale;
  title?: string;
}): ResolvedColorLegend | null {
  const {table, colorScale, title} = options;
  const {fieldName, vector} = getColumn(table, colorScale.field);
  const resolvedTitle = title && title.trim() ? title.trim() : fieldName;

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
    const values = unique(
      Array.from({length: vector.length}, (_, index) =>
        vector.get(index),
      ).filter(
        (value): value is string | number | boolean =>
          value != null &&
          (typeof value === 'string' ||
            typeof value === 'number' ||
            typeof value === 'boolean'),
      ),
    );

    if (values.length === 0) {
      return null;
    }

    return {
      type: 'categorical',
      title: resolvedTitle,
      items: values.map((value, index) => ({
        label: String(value),
        color: parseColorString(range[index % range.length]!),
      })),
    };
  }

  const numericValues = getNumericValues(vector);
  if (numericValues.length === 0) {
    return null;
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
    const scaleInterpolator = colorScale.reverse
      ? (t: number) => interpolator(1 - t)
      : interpolator;
    const stops = [0, 0.25, 0.5, 0.75, 1]
      .map((offset) => `${scaleInterpolator(offset)} ${offset * 100}%`)
      .join(', ');

    return {
      type: 'continuous',
      title: resolvedTitle,
      gradient: `linear-gradient(to right, ${stops})`,
      ticks: [
        {label: formatLegendNumber(domain[0]), offset: 0},
        {label: formatLegendNumber((domain[0] + domain[1]) / 2), offset: 50},
        {label: formatLegendNumber(domain[1]), offset: 100},
      ],
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
  const scaleInterpolator = colorScale.reverse
    ? (t: number) => interpolator(1 - t)
    : interpolator;
  const stops = [0, 0.25, 0.5, 0.75, 1]
    .map((offset) => `${scaleInterpolator(offset)} ${offset * 100}%`)
    .join(', ');

  return {
    type: 'continuous',
    title: resolvedTitle,
    gradient: `linear-gradient(to right, ${stops})`,
    ticks: [
      {label: formatLegendNumber(domain[0]), offset: 0},
      {label: formatLegendNumber(domain[1]), offset: 50},
      {label: formatLegendNumber(domain[2]), offset: 100},
    ],
  };
}
