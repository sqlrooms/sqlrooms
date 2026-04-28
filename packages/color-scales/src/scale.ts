import {rgb} from 'd3-color';
import {
  scaleDiverging,
  scaleOrdinal,
  scaleQuantile,
  scaleQuantize,
  scaleSequential,
  scaleThreshold,
} from 'd3-scale';
import {
  categoricalSchemeColors,
  continuousDivergingInterpolators,
  continuousSequentialInterpolators,
  discreteNumericSchemes,
  type BinnedNumericScheme,
  type CategoricalScheme,
  type ContinuousDivergingScheme,
  type ContinuousSequentialScheme,
} from './colorSchemes';
import type {
  ColorScaleConfig,
  ColorScaleValue,
  NumericColorScaleConfig,
  ResolvedColorLegend,
  ResolvedRGBA,
} from './config';

const DEFAULT_NULL_COLOR: ResolvedRGBA = [0, 0, 0, 0];
const DEFAULT_UNKNOWN_COLOR: ResolvedRGBA = [180, 180, 180, 180];
const DEFAULT_BIN_COUNT = 5;

type DiscreteScaleWithInvertExtent = {
  invertExtent: (value: string) => [unknown, unknown];
};

type NumericColorScale = ((value: number) => string) &
  DiscreteScaleWithInvertExtent;

export function coerceFiniteNumber(value: unknown) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === 'bigint') {
    const num = Number(value);
    return Number.isFinite(num) ? num : undefined;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

export function normalizeColor(
  color: [number, number, number, number?] | undefined,
  fallback: ResolvedRGBA,
) {
  if (!color) {
    return fallback;
  }

  return [color[0], color[1], color[2], color[3] ?? 255] as ResolvedRGBA;
}

export function parseColorString(value: string, alpha = 255) {
  const parsed = rgb(value);
  return [parsed.r, parsed.g, parsed.b, alpha] as ResolvedRGBA;
}

export function resolveColorLegendTitle(
  colorScale: ColorScaleConfig,
  title?: string,
) {
  if (title && title.trim()) {
    return title.trim();
  }

  const legend = colorScale.legend;
  if (legend && typeof legend === 'object' && legend.title?.trim()) {
    return legend.title.trim();
  }

  return colorScale.field;
}

export function isContinuousColorScale(
  colorScale: ColorScaleConfig,
): colorScale is Extract<ColorScaleConfig, {type: 'sequential' | 'diverging'}> {
  return colorScale.type === 'sequential' || colorScale.type === 'diverging';
}

export function isSteppedColorScale(
  colorScale: ColorScaleConfig,
): colorScale is Extract<
  ColorScaleConfig,
  {type: 'quantize' | 'quantile' | 'threshold'}
> {
  return (
    colorScale.type === 'quantize' ||
    colorScale.type === 'quantile' ||
    colorScale.type === 'threshold'
  );
}

export function isCategoricalColorScale(
  colorScale: ColorScaleConfig,
): colorScale is Extract<ColorScaleConfig, {type: 'categorical'}> {
  return colorScale.type === 'categorical';
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
    continuousSequentialInterpolators[scheme as ContinuousSequentialScheme];
  if (sequential) {
    return sequential;
  }

  return continuousDivergingInterpolators[scheme as ContinuousDivergingScheme];
}

export function getDiscreteNumericColors(options: {
  scheme: BinnedNumericScheme;
  bins: number;
  reverse?: boolean;
}) {
  const {scheme, reverse} = options;
  const bins = clampBinCount(options.bins);
  const discreteScheme = discreteNumericSchemes[scheme];
  const directColors = discreteScheme[bins];
  const colors = Array.isArray(directColors)
    ? [...directColors]
    : sampleInterpolator(
        getNumericInterpolator(scheme) ??
          (() => {
            throw new Error(
              `Unsupported numeric color scale scheme "${scheme}".`,
            );
          })(),
        bins,
      );

  return reverse ? colors.reverse() : colors;
}

function extent(values: number[]): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return [min, max];
}

export function getSequentialDomain(values: number[]) {
  const [min, max] = extent(values);
  if (min === max) {
    return [min - 1, max + 1] as [number, number];
  }

  return [min, max] as [number, number];
}

export function getDivergingDomain(values: number[]) {
  const [min, max] = extent(values);
  if (min === max) {
    return [min - 1, min, max + 1] as [number, number, number];
  }

  if (min < 0 && max > 0) {
    return [min, 0, max] as [number, number, number];
  }

  return [min, (min + max) / 2, max] as [number, number, number];
}

function getNumericValues(values: unknown[]) {
  const numericValues: number[] = [];
  for (const value of values) {
    const numericValue = coerceFiniteNumber(value);
    if (numericValue !== undefined) {
      numericValues.push(numericValue);
    }
  }

  return numericValues;
}

function getCategoricalValues(values: unknown[]) {
  return values.filter(
    (value): value is ColorScaleValue =>
      value != null &&
      (typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'),
  );
}

function buildGradient(interpolator: (t: number) => string) {
  return `linear-gradient(to right, ${[0, 0.25, 0.5, 0.75, 1]
    .map((offset) => `${interpolator(offset)} ${offset * 100}%`)
    .join(', ')})`;
}

function formatLegendNumber(value: number) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: Math.abs(value) >= 100 ? 0 : 2,
  }).format(value);
}

function formatExtentLabel(extent: [unknown, unknown]) {
  const start = coerceFiniteNumber(extent[0]);
  const end = coerceFiniteNumber(extent[1]);

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

function buildSteppedLegendTicks(
  scale: DiscreteScaleWithInvertExtent,
  range: string[],
) {
  if (range.length < 2) {
    return [];
  }

  return range.slice(0, -1).flatMap((color, index) => {
    const end = coerceFiniteNumber(scale.invertExtent(color)[1]);
    if (end === undefined) {
      return [];
    }

    return [
      {
        label: formatLegendNumber(end),
        offset: ((index + 1) / range.length) * 100,
      },
    ];
  });
}

function createNullColorAccessor(nullColor: ResolvedRGBA) {
  return () => nullColor;
}

function getNumericScale(
  colorScale: NumericColorScaleConfig,
  numericValues: number[],
) {
  if (colorScale.type === 'sequential') {
    const interpolator = continuousSequentialInterpolators[colorScale.scheme];
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
    return {
      kind: 'continuous' as const,
      scale,
      domain,
      interpolator: colorInterpolator,
    };
  }

  if (colorScale.type === 'diverging') {
    const interpolator = continuousDivergingInterpolators[colorScale.scheme];
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
    return {
      kind: 'continuous' as const,
      scale,
      domain,
      interpolator: colorInterpolator,
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
    return {kind: 'stepped' as const, scale, range};
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
    return {kind: 'stepped' as const, scale, range};
  }

  const thresholds = [...colorScale.thresholds].sort(
    (left, right) => left - right,
  );
  if (!thresholds.length) {
    throw new Error('Threshold color scale requires at least one threshold.');
  }

  const range = getDiscreteNumericColors({
    scheme: colorScale.scheme,
    bins: thresholds.length + 1,
    reverse: colorScale.reverse,
  });
  const scale = scaleThreshold<number, string>()
    .domain(thresholds)
    .range(range) as unknown as NumericColorScale;
  return {kind: 'stepped' as const, scale, range};
}

export function createColorScaleMapper(options: {
  colorScale: ColorScaleConfig;
  values?: unknown[];
}) {
  const {colorScale} = options;
  const values = options.values ?? [];
  const nullColor = normalizeColor(colorScale.nullColor, DEFAULT_NULL_COLOR);

  if (colorScale.type === 'categorical') {
    const baseRange =
      categoricalSchemeColors[colorScale.scheme as CategoricalScheme];
    if (!baseRange) {
      throw new Error(
        `Unsupported categorical color scale scheme "${colorScale.scheme}".`,
      );
    }

    const range = colorScale.reverse
      ? [...baseRange].reverse()
      : [...baseRange];
    const domain = unique(
      getCategoricalValues(values).map((value) => String(value)),
    );
    const scale = scaleOrdinal<string, string>(range).domain(domain);
    const unknownColor = normalizeColor(
      colorScale.unknownColor,
      DEFAULT_UNKNOWN_COLOR,
    );

    return (value: unknown) => {
      if (value == null) {
        return nullColor;
      }

      if (
        typeof value !== 'string' &&
        typeof value !== 'number' &&
        typeof value !== 'boolean'
      ) {
        return unknownColor;
      }

      const key = String(value);
      if (!domain.includes(key)) {
        return unknownColor;
      }

      return parseColorString(scale(key));
    };
  }

  const numericValues = getNumericValues(values);
  const needsSamples =
    colorScale.type === 'quantile' ||
    ('domain' in colorScale && colorScale.domain === 'auto');
  if (needsSamples && numericValues.length === 0) {
    return createNullColorAccessor(nullColor);
  }

  const numericScale = getNumericScale(colorScale, numericValues);
  return (value: unknown) => {
    const numericValue = coerceFiniteNumber(value);
    if (numericValue === undefined) {
      return nullColor;
    }

    return parseColorString(numericScale.scale(numericValue) as string);
  };
}

export function buildColorScaleLegend(options: {
  colorScale: ColorScaleConfig;
  values?: unknown[];
  title?: string;
}): ResolvedColorLegend | null {
  const {colorScale} = options;
  const values = options.values ?? [];
  const resolvedTitle = resolveColorLegendTitle(colorScale, options.title);

  if (colorScale.type === 'categorical') {
    const baseRange =
      categoricalSchemeColors[colorScale.scheme as CategoricalScheme];
    const range = colorScale.reverse
      ? [...baseRange].reverse()
      : [...baseRange];
    const categories = unique(
      getCategoricalValues(values).map((value) => String(value)),
    );

    if (categories.length === 0) {
      return null;
    }

    return {
      type: 'categorical',
      title: resolvedTitle,
      items: categories.map((value, index) => ({
        label: value,
        color: parseColorString(range[index % range.length]!),
      })),
    };
  }

  const numericValues = getNumericValues(values);
  const needsSamples =
    colorScale.type === 'quantile' ||
    ('domain' in colorScale && colorScale.domain === 'auto');
  if (needsSamples && numericValues.length === 0) {
    return null;
  }

  const numericScale = getNumericScale(colorScale, numericValues);
  if (numericScale.kind === 'continuous') {
    const domain = numericScale.domain;
    const ticks =
      colorScale.type === 'diverging'
        ? (() => {
            const divergingDomain = domain as [number, number, number];
            return [
              {label: formatLegendNumber(divergingDomain[0]), offset: 0},
              {label: formatLegendNumber(divergingDomain[1]), offset: 50},
              {label: formatLegendNumber(divergingDomain[2]), offset: 100},
            ];
          })()
        : (() => {
            const sequentialDomain = domain as [number, number];
            return [
              {label: formatLegendNumber(sequentialDomain[0]), offset: 0},
              {
                label: formatLegendNumber(
                  (sequentialDomain[0] + sequentialDomain[1]) / 2,
                ),
                offset: 50,
              },
              {label: formatLegendNumber(sequentialDomain[1]), offset: 100},
            ];
          })();

    return {
      type: 'continuous',
      title: resolvedTitle,
      gradient: buildGradient(numericScale.interpolator),
      ticks,
    };
  }

  return {
    type: 'stepped',
    title: resolvedTitle,
    items: buildSteppedLegendItems(numericScale.scale, numericScale.range),
    ticks: buildSteppedLegendTicks(numericScale.scale, numericScale.range),
  };
}
