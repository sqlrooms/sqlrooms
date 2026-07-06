import type {Spec} from '@uwdata/mosaic-spec';
import {
  CountPlotChartSettings,
  CountPlotSort,
  DEFAULT_COUNT_PLOT_MAX_BARS,
  MAX_COUNT_PLOT_MAX_BARS,
  MIN_COUNT_PLOT_MAX_BARS,
} from './schema';
import {CreateSpecOptions, getChartTableReference} from '../base-types';
import {validateCountPlotSettings} from './validation';
import type {AggregateFunction} from '../../../schemas';
import type {TableColumn} from '@sqlrooms/duckdb';

const BG_COLOR = 'var(--color-chart-overlay)';
const FG_COLOR = 'var(--color-chart-1)';
const MIN_AUTO_LEFT_MARGIN = 72;
const MAX_AUTO_LEFT_MARGIN = 220;
const LABEL_CHARACTER_WIDTH = 8;
const AXIS_GUTTER_WIDTH = 40;
const HEIGHT_MARGINS = {top: 20, bottom: 50};
const COUNT_PLOT_BAR_HEIGHT = 32;
const COUNT_PLOT_ROW_GAP = 10;
const COUNT_PLOT_OUTER_GAP = 16;
const COUNT_PLOT_ROW_STEP = COUNT_PLOT_BAR_HEIGHT + COUNT_PLOT_ROW_GAP;
const DEFAULT_Y_PADDING_INNER = COUNT_PLOT_ROW_GAP / COUNT_PLOT_ROW_STEP;
const DEFAULT_Y_PADDING_OUTER = COUNT_PLOT_OUTER_GAP / COUNT_PLOT_ROW_STEP;

type CountPlotMarkSort = {
  y: 'x' | '-x' | 'y' | '-y';
  limit: number;
};

export type CreateCountPlotSpecOptions =
  CreateSpecOptions<CountPlotChartSettings> & {
    /**
     * Number of categories expected to render after applying the count plot
     * category cap. When omitted, the chart sizes itself for `maxBars`.
     */
    visibleCategoryCount?: number;
  };

function clampInteger(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, Math.round(value)));
}

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
  maxBars: number,
): CountPlotMarkSort {
  const sortOption = sort ?? 'value-desc';
  const channel = sortOption.startsWith('label') ? 'y' : 'x';
  const descending = sortOption.endsWith('desc');

  return {y: `${descending ? '-' : ''}${channel}`, limit: maxBars};
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

function getPlotHeight(maxBars: number): number {
  return (
    HEIGHT_MARGINS.top +
    HEIGHT_MARGINS.bottom +
    maxBars * COUNT_PLOT_BAR_HEIGHT +
    Math.max(0, maxBars - 1) * COUNT_PLOT_ROW_GAP +
    2 * COUNT_PLOT_OUTER_GAP
  );
}

function getVisibleBarCount(
  visibleCategoryCount: number | undefined,
  maxBars: number,
): number {
  if (
    visibleCategoryCount === undefined ||
    !Number.isFinite(visibleCategoryCount)
  ) {
    return maxBars;
  }

  return Math.max(1, Math.min(maxBars, Math.ceil(visibleCategoryCount)));
}

export function createCountPlotSpec(options: CreateCountPlotSpecOptions): Spec {
  const {dataTable, selectionName, settings} = options;

  const {aggregate, fieldColumn, metric, valueColumn} =
    validateCountPlotSettings(options);
  const tableReference = getChartTableReference(dataTable);
  const metricChannel = getMetricChannel(metric, aggregate, valueColumn);
  const maxBars = clampInteger(
    settings.maxBars,
    DEFAULT_COUNT_PLOT_MAX_BARS,
    MIN_COUNT_PLOT_MAX_BARS,
    MAX_COUNT_PLOT_MAX_BARS,
  );
  const yChannel = fieldColumn.name;
  const markSort = getSortConfig(settings.sort, maxBars);
  const visibleBarCount = getVisibleBarCount(
    options.visibleCategoryCount,
    maxBars,
  );

  // Count plot shows categorical frequency as horizontal bars
  // Categories on Y-axis, counts on X-axis
  const plot: unknown[] = [
    {
      mark: 'barX',
      data: {from: tableReference},
      x: metricChannel,
      y: yChannel,
      sort: markSort,
      fill: BG_COLOR,
      inset: 0.5,
    },
    {
      mark: 'barX',
      data: {from: tableReference, filterBy: '$brush'},
      x: metricChannel,
      y: yChannel,
      sort: markSort,
      fill: FG_COLOR,
      inset: 0.5,
    },
    {
      mark: 'text',
      data: {from: tableReference, filterBy: '$brush'},
      x: metricChannel,
      y: yChannel,
      sort: markSort,
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
    height: getPlotHeight(visibleBarCount),
    width: 380,
    yPaddingInner: DEFAULT_Y_PADDING_INNER,
    yPaddingOuter: DEFAULT_Y_PADDING_OUTER,
    margins: {
      left: deriveLeftMargin(fieldColumn, settings.leftMargin),
      right: 50,
      ...HEIGHT_MARGINS,
    },
    params: {brush: {select: 'crossfilter'}},
  } as Spec;
}
