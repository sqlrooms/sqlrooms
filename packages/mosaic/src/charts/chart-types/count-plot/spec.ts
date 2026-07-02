import type {Spec} from '@uwdata/mosaic-spec';
import {CountPlotChartSettings, CountPlotSort} from './schema';
import {CreateSpecOptions, getChartTableReference} from '../base-types';
import {validateCountPlotSettings} from './validation';
import type {AggregateFunction} from '../../../schemas';
import type {TableColumn} from '@sqlrooms/duckdb';

const BG_COLOR = 'var(--color-chart-overlay)';
const FG_COLOR = 'var(--color-chart-1)';
const CATEGORY_LIMIT = 100;
const MIN_AUTO_LEFT_MARGIN = 72;
const MAX_AUTO_LEFT_MARGIN = 220;
const LABEL_CHARACTER_WIDTH = 8;
const AXIS_GUTTER_WIDTH = 40;

function clampMargin(value: number): number {
  return Math.max(0, Math.min(320, Math.round(value)));
}

function deriveLeftMargin(
  fieldColumn: TableColumn,
  manualLeftMargin: number | undefined,
): number {
  if (manualLeftMargin !== undefined) {
    return clampMargin(manualLeftMargin);
  }

  const estimatedLabelWidth =
    fieldColumn.name.length * LABEL_CHARACTER_WIDTH + AXIS_GUTTER_WIDTH;

  return Math.max(
    MIN_AUTO_LEFT_MARGIN,
    Math.min(MAX_AUTO_LEFT_MARGIN, Math.round(estimatedLabelWidth)),
  );
}

function getMetricChannel(
  metric: 'count' | 'aggregate',
  aggregate: AggregateFunction,
  valueColumn: TableColumn | undefined,
): Record<string, string | null> {
  if (metric === 'count') {
    return {count: null};
  }

  if (!valueColumn) {
    return {count: null};
  }

  return {[aggregate]: valueColumn.name};
}

function getSortConfig(
  sort: CountPlotSort | undefined,
  metric: 'count' | 'aggregate',
  aggregate: AggregateFunction,
): unknown {
  const sortOption = sort ?? 'value-desc';
  const order = sortOption.endsWith('asc') ? 'asc' : 'desc';

  if (sortOption.startsWith('label')) {
    return {y: 'min', order, limit: CATEGORY_LIMIT};
  }

  return {
    x: metric === 'count' ? 'sum' : aggregate,
    order,
    limit: CATEGORY_LIMIT,
  };
}

function getValueLabel(
  metric: 'count' | 'aggregate',
  aggregate: AggregateFunction,
  valueColumn: TableColumn | undefined,
): string {
  if (metric === 'count' || !valueColumn) {
    return 'Count';
  }

  return `${aggregate.toUpperCase()} ${valueColumn.name}`;
}

export function createCountPlotSpec(
  options: CreateSpecOptions<CountPlotChartSettings>,
): Spec {
  const {dataTable, selectionName, settings} = options;

  const {aggregate, fieldColumn, metric, valueColumn} =
    validateCountPlotSettings(options);
  const tableReference = getChartTableReference(dataTable);
  const metricChannel = getMetricChannel(metric, aggregate, valueColumn);
  const yChannel = {
    column: fieldColumn.name,
    sort: getSortConfig(settings.sort, metric, aggregate),
  };

  // Count plot shows categorical frequency as horizontal bars
  // Categories on Y-axis, counts on X-axis
  const plot: unknown[] = [
    {
      mark: 'barX',
      data: {from: tableReference},
      x: metricChannel,
      y: yChannel,
      fill: BG_COLOR,
      inset: 0.5,
    },
    {
      mark: 'barX',
      data: {from: tableReference, filterBy: '$brush'},
      x: metricChannel,
      y: yChannel,
      fill: FG_COLOR,
      inset: 0.5,
    },
    {
      mark: 'text',
      data: {from: tableReference, filterBy: '$brush'},
      x: metricChannel,
      y: yChannel,
      text: metricChannel,
      dx: 5,
      textAnchor: 'start',
      fill: 'currentColor',
      fontSize: 11,
    },
  ];

  if (selectionName) {
    plot.push({select: 'intervalY', as: '$brush'});
  }

  return {
    plot,
    xLabel: getValueLabel(metric, aggregate, valueColumn),
    yLabel: fieldColumn.name,
    height: 400,
    width: 380,
    margins: {
      left: deriveLeftMargin(fieldColumn, settings.leftMargin),
      right: 50,
      top: 20,
      bottom: 50,
    },
    params: {brush: {select: 'crossfilter'}},
  } as Spec;
}
