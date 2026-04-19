import type * as arrow from 'apache-arrow';
import {rgb} from 'd3-color';
import {
  scaleDiverging,
  scaleOrdinal,
  scaleQuantile,
  scaleQuantize,
  scaleSequential,
  scaleThreshold,
} from 'd3-scale';
import * as chromatic from 'd3-scale-chromatic';
import type {
  BinnedNumericScheme,
  CategoricalScheme,
  ContinuousDivergingScheme,
  ContinuousSequentialScheme,
  LayerColorScale,
} from '../types';

const DEFAULT_NULL_COLOR: [number, number, number, number] = [0, 0, 0, 0];
const DEFAULT_UNKNOWN_COLOR: [number, number, number, number] = [
  180, 180, 180, 180,
];
const DEFAULT_BIN_COUNT = 5;

const CONTINUOUS_SEQUENTIAL_SCHEMES: Record<
  ContinuousSequentialScheme,
  (t: number) => string
> = {
  Blues: chromatic.interpolateBlues,
  BuGn: chromatic.interpolateBuGn,
  BuPu: chromatic.interpolateBuPu,
  Cividis: chromatic.interpolateCividis,
  Cool: chromatic.interpolateCool,
  CubehelixDefault: chromatic.interpolateCubehelixDefault,
  GnBu: chromatic.interpolateGnBu,
  Greens: chromatic.interpolateGreens,
  Greys: chromatic.interpolateGreys,
  Inferno: chromatic.interpolateInferno,
  Magma: chromatic.interpolateMagma,
  OrRd: chromatic.interpolateOrRd,
  Oranges: chromatic.interpolateOranges,
  Plasma: chromatic.interpolatePlasma,
  PuBu: chromatic.interpolatePuBu,
  PuBuGn: chromatic.interpolatePuBuGn,
  PuRd: chromatic.interpolatePuRd,
  Purples: chromatic.interpolatePurples,
  Rainbow: chromatic.interpolateRainbow,
  RdPu: chromatic.interpolateRdPu,
  Reds: chromatic.interpolateReds,
  Sinebow: chromatic.interpolateSinebow,
  Turbo: chromatic.interpolateTurbo,
  Viridis: chromatic.interpolateViridis,
  Warm: chromatic.interpolateWarm,
  YlGn: chromatic.interpolateYlGn,
  YlGnBu: chromatic.interpolateYlGnBu,
  YlOrBr: chromatic.interpolateYlOrBr,
  YlOrRd: chromatic.interpolateYlOrRd,
};

const CONTINUOUS_DIVERGING_SCHEMES: Record<
  ContinuousDivergingScheme,
  (t: number) => string
> = {
  BrBG: chromatic.interpolateBrBG,
  PRGn: chromatic.interpolatePRGn,
  PiYG: chromatic.interpolatePiYG,
  PuOr: chromatic.interpolatePuOr,
  RdBu: chromatic.interpolateRdBu,
  RdGy: chromatic.interpolateRdGy,
  RdYlBu: chromatic.interpolateRdYlBu,
  RdYlGn: chromatic.interpolateRdYlGn,
  Spectral: chromatic.interpolateSpectral,
};

const DISCRETE_NUMERIC_SCHEMES: Record<
  BinnedNumericScheme,
  ReadonlyArray<ReadonlyArray<string>>
> = {
  Blues: chromatic.schemeBlues,
  BuGn: chromatic.schemeBuGn,
  BuPu: chromatic.schemeBuPu,
  GnBu: chromatic.schemeGnBu,
  Greens: chromatic.schemeGreens,
  Greys: chromatic.schemeGreys,
  OrRd: chromatic.schemeOrRd,
  Oranges: chromatic.schemeOranges,
  PuBu: chromatic.schemePuBu,
  PuBuGn: chromatic.schemePuBuGn,
  PuRd: chromatic.schemePuRd,
  Purples: chromatic.schemePurples,
  RdPu: chromatic.schemeRdPu,
  Reds: chromatic.schemeReds,
  YlGn: chromatic.schemeYlGn,
  YlGnBu: chromatic.schemeYlGnBu,
  YlOrBr: chromatic.schemeYlOrBr,
  YlOrRd: chromatic.schemeYlOrRd,
  BrBG: chromatic.schemeBrBG,
  PRGn: chromatic.schemePRGn,
  PiYG: chromatic.schemePiYG,
  PuOr: chromatic.schemePuOr,
  RdBu: chromatic.schemeRdBu,
  RdGy: chromatic.schemeRdGy,
  RdYlBu: chromatic.schemeRdYlBu,
  RdYlGn: chromatic.schemeRdYlGn,
  Spectral: chromatic.schemeSpectral,
};

const CATEGORICAL_SCHEMES: Record<CategoricalScheme, ReadonlyArray<string>> = {
  Accent: chromatic.schemeAccent,
  Category10: chromatic.schemeCategory10,
  Dark2: chromatic.schemeDark2,
  Observable10: chromatic.schemeObservable10,
  Paired: chromatic.schemePaired,
  Pastel1: chromatic.schemePastel1,
  Pastel2: chromatic.schemePastel2,
  Set1: chromatic.schemeSet1,
  Set2: chromatic.schemeSet2,
  Set3: chromatic.schemeSet3,
  Tableau10: chromatic.schemeTableau10,
};

type DiscreteScaleWithInvertExtent = {
  invertExtent: (value: string) => [unknown, unknown];
};
type NumericColorScale = ((value: number) => string) &
  DiscreteScaleWithInvertExtent;

export type ResolvedColorLegend =
  | {
      type: 'continuous';
      title: string;
      gradient: string;
      ticks: Array<{label: string; offset: number}>;
    }
  | {
      type: 'stepped';
      title: string;
      items: Array<{label: string; color: [number, number, number, number]}>;
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

function clampBinCount(bins: number) {
  return Math.max(2, Math.round(bins));
}

function sampleInterpolator(interpolator: (t: number) => string, bins: number) {
  if (bins === 1) {
    return [interpolator(0.5)];
  }

  return Array.from({length: bins}, (_, index) =>
    interpolator(index / (bins - 1)),
  );
}

function getNumericInterpolator(scheme: BinnedNumericScheme) {
  const sequential =
    CONTINUOUS_SEQUENTIAL_SCHEMES[scheme as ContinuousSequentialScheme];
  if (sequential) {
    return sequential;
  }

  return CONTINUOUS_DIVERGING_SCHEMES[scheme as ContinuousDivergingScheme];
}

function getDiscreteNumericColors(options: {
  scheme: BinnedNumericScheme;
  bins: number;
  reverse?: boolean;
}) {
  const {scheme, reverse} = options;
  const bins = clampBinCount(options.bins);
  const discreteScheme = DISCRETE_NUMERIC_SCHEMES[scheme];
  const directColors = discreteScheme[bins];
  const colors = Array.isArray(directColors)
    ? [...directColors]
    : sampleInterpolator(
        getNumericInterpolator(scheme) ??
          (() => {
            throw new Error(
              `Unsupported numeric colorScale scheme "${scheme}".`,
            );
          })(),
        bins,
      );

  return reverse ? colors.reverse() : colors;
}

function formatExtentLabel(extent: [unknown, unknown]) {
  const start = toFiniteNumber(extent[0]);
  const end = toFiniteNumber(extent[1]);

  if (start === undefined && end === undefined) {
    return 'unknown';
  }

  if (start === undefined && end !== undefined) {
    return `< ${formatLegendNumber(end)}`;
  }

  if (start !== undefined && end === undefined) {
    return `>= ${formatLegendNumber(start)}`;
  }

  return `${formatLegendNumber(start!)} - ${formatLegendNumber(end!)}`;
}

function buildSteppedLegendItems(
  scale: DiscreteScaleWithInvertExtent,
  range: string[],
) {
  return range.map((color) => ({
    label: formatExtentLabel(scale.invertExtent(color)),
    color: parseColorString(color),
  }));
}

function buildGradient(interpolator: (t: number) => string) {
  return `linear-gradient(to right, ${[0, 0.25, 0.5, 0.75, 1]
    .map((offset) => `${interpolator(offset)} ${offset * 100}%`)
    .join(', ')})`;
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

function createContinuousAccessor(options: {
  fieldName: string;
  vector: arrow.Vector;
  nullColor: [number, number, number, number];
  colorForValue: (value: number) => string;
}) {
  const {fieldName, vector, nullColor, colorForValue} = options;

  return (value: unknown) => {
    const rawValue = getGeoArrowOrRowValue({value, fieldName, vector});
    const numericValue = toFiniteNumber(rawValue);
    if (numericValue === undefined) {
      return nullColor;
    }

    return parseColorString(colorForValue(numericValue));
  };
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
    const interpolator = CONTINUOUS_SEQUENTIAL_SCHEMES[colorScale.scheme];
    const domain =
      colorScale.domain === 'auto'
        ? getSequentialDomain(numericValues)
        : colorScale.domain;
    const colorInterpolator = colorScale.reverse
      ? (t: number) => interpolator(1 - t)
      : interpolator;
    const scale = scaleSequential(colorInterpolator).domain(domain);
    if (colorScale.clamp) {
      scale.clamp(true);
    }

    return createContinuousAccessor({
      fieldName,
      vector,
      nullColor,
      colorForValue: (value) => scale(value) as string,
    });
  }

  if (colorScale.type === 'diverging') {
    const interpolator = CONTINUOUS_DIVERGING_SCHEMES[colorScale.scheme];
    const domain =
      colorScale.domain === 'auto'
        ? getDivergingDomain(numericValues)
        : colorScale.domain;
    const colorInterpolator = colorScale.reverse
      ? (t: number) => interpolator(1 - t)
      : interpolator;
    const scale = scaleDiverging(colorInterpolator).domain(domain);
    if (colorScale.clamp) {
      scale.clamp(true);
    }

    return createContinuousAccessor({
      fieldName,
      vector,
      nullColor,
      colorForValue: (value) => scale(value) as string,
    });
  }

  if (colorScale.type === 'quantize') {
    const range = getDiscreteNumericColors({
      scheme: colorScale.scheme,
      bins: colorScale.bins ?? DEFAULT_BIN_COUNT,
      reverse: colorScale.reverse,
    });
    const domain =
      colorScale.domain === 'auto'
        ? getSequentialDomain(numericValues)
        : colorScale.domain;
    const scale = scaleQuantize<number, string>()
      .domain(domain)
      .range(range) as unknown as NumericColorScale;

    return createContinuousAccessor({
      fieldName,
      vector,
      nullColor,
      colorForValue: scale,
    });
  }

  if (colorScale.type === 'quantile') {
    const range = getDiscreteNumericColors({
      scheme: colorScale.scheme,
      bins: colorScale.bins ?? DEFAULT_BIN_COUNT,
      reverse: colorScale.reverse,
    });
    const scale = scaleQuantile<string>()
      .domain(numericValues)
      .range(range) as unknown as NumericColorScale;

    return createContinuousAccessor({
      fieldName,
      vector,
      nullColor,
      colorForValue: scale,
    });
  }

  const thresholds = [...colorScale.thresholds].sort(
    (left, right) => left - right,
  );
  if (!thresholds.length) {
    throw new Error('Threshold colorScale requires at least one threshold.');
  }

  const range = getDiscreteNumericColors({
    scheme: colorScale.scheme,
    bins: thresholds.length + 1,
    reverse: colorScale.reverse,
  });
  const scale = scaleThreshold<number, string>()
    .domain(thresholds)
    .range(range) as unknown as NumericColorScale;

  return createContinuousAccessor({
    fieldName,
    vector,
    nullColor,
    colorForValue: (value) => scale(value) as string,
  });
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
    const interpolator = CONTINUOUS_SEQUENTIAL_SCHEMES[colorScale.scheme];
    const domain =
      colorScale.domain === 'auto'
        ? getSequentialDomain(numericValues)
        : colorScale.domain;
    const colorInterpolator = colorScale.reverse
      ? (t: number) => interpolator(1 - t)
      : interpolator;

    return {
      type: 'continuous',
      title: resolvedTitle,
      gradient: buildGradient(colorInterpolator),
      ticks: [
        {label: formatLegendNumber(domain[0]), offset: 0},
        {label: formatLegendNumber((domain[0] + domain[1]) / 2), offset: 50},
        {label: formatLegendNumber(domain[1]), offset: 100},
      ],
    };
  }

  if (colorScale.type === 'diverging') {
    const interpolator = CONTINUOUS_DIVERGING_SCHEMES[colorScale.scheme];
    const domain =
      colorScale.domain === 'auto'
        ? getDivergingDomain(numericValues)
        : colorScale.domain;
    const colorInterpolator = colorScale.reverse
      ? (t: number) => interpolator(1 - t)
      : interpolator;

    return {
      type: 'continuous',
      title: resolvedTitle,
      gradient: buildGradient(colorInterpolator),
      ticks: [
        {label: formatLegendNumber(domain[0]), offset: 0},
        {label: formatLegendNumber(domain[1]), offset: 50},
        {label: formatLegendNumber(domain[2]), offset: 100},
      ],
    };
  }

  if (colorScale.type === 'quantize') {
    const range = getDiscreteNumericColors({
      scheme: colorScale.scheme,
      bins: colorScale.bins ?? DEFAULT_BIN_COUNT,
      reverse: colorScale.reverse,
    });
    const domain =
      colorScale.domain === 'auto'
        ? getSequentialDomain(numericValues)
        : colorScale.domain;
    const scale = scaleQuantize<number, string>()
      .domain(domain)
      .range(range) as unknown as NumericColorScale;

    return {
      type: 'stepped',
      title: resolvedTitle,
      items: buildSteppedLegendItems(scale, range),
    };
  }

  if (colorScale.type === 'quantile') {
    const range = getDiscreteNumericColors({
      scheme: colorScale.scheme,
      bins: colorScale.bins ?? DEFAULT_BIN_COUNT,
      reverse: colorScale.reverse,
    });
    const scale = scaleQuantile<string>()
      .domain(numericValues)
      .range(range) as unknown as NumericColorScale;

    return {
      type: 'stepped',
      title: resolvedTitle,
      items: buildSteppedLegendItems(scale, range),
    };
  }

  const thresholds = [...colorScale.thresholds].sort(
    (left, right) => left - right,
  );
  if (!thresholds.length) {
    return null;
  }

  const range = getDiscreteNumericColors({
    scheme: colorScale.scheme,
    bins: thresholds.length + 1,
    reverse: colorScale.reverse,
  });
  const scale = scaleThreshold<number, string>()
    .domain(thresholds)
    .range(range) as unknown as NumericColorScale;

  return {
    type: 'stepped',
    title: resolvedTitle,
    items: buildSteppedLegendItems(scale, range),
  };
}
