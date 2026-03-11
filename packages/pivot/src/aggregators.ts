import {escapeId} from '@sqlrooms/duckdb';

export type PivotAggregatorKind =
  | 'default'
  | 'fraction_total'
  | 'fraction_row'
  | 'fraction_col';

export type PivotValueRequirement = 'any' | 'numeric';

export type PivotAggregatorDefinition = {
  name: string;
  numInputs: number;
  kind: PivotAggregatorKind;
  valueRequirement: PivotValueRequirement;
  format: (value: unknown) => string;
  buildSql: (valueColumns: string[]) => string;
};

const formatInteger = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});
const formatDecimal = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
const formatPercent = new Intl.NumberFormat('en-US', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function formatNumber(value: unknown, formatter: Intl.NumberFormat) {
  const numeric = typeof value === 'bigint' ? Number(value) : Number(value);
  if (!Number.isFinite(numeric)) {
    return '';
  }
  return formatter.format(numeric);
}

function formatIdentity(value: unknown) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value);
}

function escapeColumn(column: string) {
  return escapeId(column);
}

function requireColumn(column: string | undefined, position: number) {
  if (!column) {
    throw new Error(`Aggregator requires value column ${position + 1}`);
  }
  return column;
}

export const PIVOT_AGGREGATORS: Record<string, PivotAggregatorDefinition> = {
  Count: {
    name: 'Count',
    numInputs: 0,
    kind: 'default',
    valueRequirement: 'any',
    format: (value) => formatNumber(value, formatInteger),
    buildSql: () => 'COUNT(*)',
  },
  'Count Unique Values': {
    name: 'Count Unique Values',
    numInputs: 1,
    kind: 'default',
    valueRequirement: 'any',
    format: (value) => formatNumber(value, formatInteger),
    buildSql: ([column]) =>
      `COUNT(DISTINCT ${escapeColumn(requireColumn(column, 0))})`,
  },
  'List Unique Values': {
    name: 'List Unique Values',
    numInputs: 1,
    kind: 'default',
    valueRequirement: 'any',
    format: formatIdentity,
    buildSql: ([column]) =>
      `STRING_AGG(DISTINCT CAST(${escapeColumn(requireColumn(column, 0))} AS VARCHAR), ', ' ORDER BY CAST(${escapeColumn(requireColumn(column, 0))} AS VARCHAR))`,
  },
  Sum: {
    name: 'Sum',
    numInputs: 1,
    kind: 'default',
    valueRequirement: 'numeric',
    format: (value) => formatNumber(value, formatDecimal),
    buildSql: ([column]) =>
      `SUM(TRY_CAST(${escapeColumn(requireColumn(column, 0))} AS DOUBLE))`,
  },
  'Integer Sum': {
    name: 'Integer Sum',
    numInputs: 1,
    kind: 'default',
    valueRequirement: 'numeric',
    format: (value) => formatNumber(value, formatInteger),
    buildSql: ([column]) =>
      `SUM(TRY_CAST(${escapeColumn(requireColumn(column, 0))} AS DOUBLE))`,
  },
  Average: {
    name: 'Average',
    numInputs: 1,
    kind: 'default',
    valueRequirement: 'numeric',
    format: (value) => formatNumber(value, formatDecimal),
    buildSql: ([column]) =>
      `AVG(TRY_CAST(${escapeColumn(requireColumn(column, 0))} AS DOUBLE))`,
  },
  Median: {
    name: 'Median',
    numInputs: 1,
    kind: 'default',
    valueRequirement: 'numeric',
    format: (value) => formatNumber(value, formatDecimal),
    buildSql: ([column]) =>
      `MEDIAN(TRY_CAST(${escapeColumn(requireColumn(column, 0))} AS DOUBLE))`,
  },
  'Sample Variance': {
    name: 'Sample Variance',
    numInputs: 1,
    kind: 'default',
    valueRequirement: 'numeric',
    format: (value) => formatNumber(value, formatDecimal),
    buildSql: ([column]) =>
      `VAR_SAMP(TRY_CAST(${escapeColumn(requireColumn(column, 0))} AS DOUBLE))`,
  },
  'Sample Standard Deviation': {
    name: 'Sample Standard Deviation',
    numInputs: 1,
    kind: 'default',
    valueRequirement: 'numeric',
    format: (value) => formatNumber(value, formatDecimal),
    buildSql: ([column]) =>
      `STDDEV_SAMP(TRY_CAST(${escapeColumn(requireColumn(column, 0))} AS DOUBLE))`,
  },
  Minimum: {
    name: 'Minimum',
    numInputs: 1,
    kind: 'default',
    valueRequirement: 'numeric',
    format: (value) => formatNumber(value, formatDecimal),
    buildSql: ([column]) =>
      `MIN(TRY_CAST(${escapeColumn(requireColumn(column, 0))} AS DOUBLE))`,
  },
  Maximum: {
    name: 'Maximum',
    numInputs: 1,
    kind: 'default',
    valueRequirement: 'numeric',
    format: (value) => formatNumber(value, formatDecimal),
    buildSql: ([column]) =>
      `MAX(TRY_CAST(${escapeColumn(requireColumn(column, 0))} AS DOUBLE))`,
  },
  First: {
    name: 'First',
    numInputs: 1,
    kind: 'default',
    valueRequirement: 'any',
    format: formatIdentity,
    buildSql: ([column]) =>
      `FIRST(CAST(${escapeColumn(requireColumn(column, 0))} AS VARCHAR))`,
  },
  Last: {
    name: 'Last',
    numInputs: 1,
    kind: 'default',
    valueRequirement: 'any',
    format: formatIdentity,
    buildSql: ([column]) =>
      `LAST(CAST(${escapeColumn(requireColumn(column, 0))} AS VARCHAR))`,
  },
  'Sum over Sum': {
    name: 'Sum over Sum',
    numInputs: 2,
    kind: 'default',
    valueRequirement: 'numeric',
    format: (value) => formatNumber(value, formatDecimal),
    buildSql: ([numerator, denominator]) =>
      `SUM(TRY_CAST(${escapeColumn(requireColumn(numerator, 0))} AS DOUBLE)) / NULLIF(SUM(TRY_CAST(${escapeColumn(requireColumn(denominator, 1))} AS DOUBLE)), 0)`,
  },
  'Sum as Fraction of Total': {
    name: 'Sum as Fraction of Total',
    numInputs: 1,
    kind: 'fraction_total',
    valueRequirement: 'numeric',
    format: (value) => formatNumber(value, formatPercent),
    buildSql: ([column]) =>
      `SUM(TRY_CAST(${escapeColumn(requireColumn(column, 0))} AS DOUBLE))`,
  },
  'Sum as Fraction of Rows': {
    name: 'Sum as Fraction of Rows',
    numInputs: 1,
    kind: 'fraction_row',
    valueRequirement: 'numeric',
    format: (value) => formatNumber(value, formatPercent),
    buildSql: ([column]) =>
      `SUM(TRY_CAST(${escapeColumn(requireColumn(column, 0))} AS DOUBLE))`,
  },
  'Sum as Fraction of Columns': {
    name: 'Sum as Fraction of Columns',
    numInputs: 1,
    kind: 'fraction_col',
    valueRequirement: 'numeric',
    format: (value) => formatNumber(value, formatPercent),
    buildSql: ([column]) =>
      `SUM(TRY_CAST(${escapeColumn(requireColumn(column, 0))} AS DOUBLE))`,
  },
  'Count as Fraction of Total': {
    name: 'Count as Fraction of Total',
    numInputs: 0,
    kind: 'fraction_total',
    valueRequirement: 'any',
    format: (value) => formatNumber(value, formatPercent),
    buildSql: () => 'COUNT(*)',
  },
  'Count as Fraction of Rows': {
    name: 'Count as Fraction of Rows',
    numInputs: 0,
    kind: 'fraction_row',
    valueRequirement: 'any',
    format: (value) => formatNumber(value, formatPercent),
    buildSql: () => 'COUNT(*)',
  },
  'Count as Fraction of Columns': {
    name: 'Count as Fraction of Columns',
    numInputs: 0,
    kind: 'fraction_col',
    valueRequirement: 'any',
    format: (value) => formatNumber(value, formatPercent),
    buildSql: () => 'COUNT(*)',
  },
};

export const DEFAULT_PIVOT_AGGREGATOR = 'Count';

export function getPivotAggregator(name: string): PivotAggregatorDefinition {
  return (
    PIVOT_AGGREGATORS[name] || PIVOT_AGGREGATORS[DEFAULT_PIVOT_AGGREGATOR]!
  );
}

export function getAggregatorLabel(aggregatorName: string, values: string[]) {
  const aggregator = getPivotAggregator(aggregatorName);
  if (aggregator.numInputs <= 0) {
    return aggregator.name;
  }
  return `${aggregator.name} of ${values.slice(0, aggregator.numInputs).join(', ')}`;
}

export function getDefaultValuesForAggregator(args: {
  aggregatorName: string;
  fields: Array<{name: string; type: string}>;
  currentValues: string[];
}) {
  const {aggregatorName, fields, currentValues} = args;
  const aggregator = getPivotAggregator(aggregatorName);
  const candidates =
    aggregator.valueRequirement === 'numeric'
      ? fields.filter((field) =>
          /INT|DECIMAL|FLOAT|DOUBLE|REAL|HUGEINT|BIGINT/i.test(field.type),
        )
      : fields;

  const selected = currentValues.filter((value) =>
    candidates.some((field) => field.name === value),
  );

  for (const field of candidates) {
    if (selected.length >= aggregator.numInputs) {
      break;
    }
    if (!selected.includes(field.name)) {
      selected.push(field.name);
    }
  }

  return selected.slice(0, aggregator.numInputs);
}

export function formatAggregatorValue(aggregatorName: string, value: unknown) {
  if (value === null || value === undefined) {
    return '';
  }
  return getPivotAggregator(aggregatorName).format(value);
}
