import type {Spec} from '@uwdata/mosaic-spec';
import {LineChartSettings} from './schema';
import {isTemporalType} from '../../../column-types-utils';
import {AggregateFunction} from '../../../schemas';
import {CreateSpecOptions, getChartTableReference} from '../base-types';
import {DEFAULT_CHART_FALLBACK_COLOR} from '../../../constants/chart-colors';
import {validateLineChartSettings} from './validation';

/** Include the aggregation in a numeric-series legend only when it is applied. */
function getLegendLabel(
  yColumn: {field: string; aggregate?: AggregateFunction},
  hasAggregation: boolean,
): string {
  if (hasAggregation && yColumn.aggregate) {
    return `${yColumn.field} (${yColumn.aggregate.toUpperCase()})`;
  }
  return yColumn.field;
}

/**
 * Compile validated settings into a brushable Mosaic line chart. Count mode
 * uses COUNT(*) per X value/bin; numeric mode retains the configured Y series.
 * @throws When required fields, column types, or metric settings are invalid.
 */
export function createLineChartSpec(
  options: CreateSpecOptions<LineChartSettings>,
): Spec {
  const {dataTable, selectionName, settings} = options;

  const {metric, xColumn, yColumns, xInterval} =
    validateLineChartSettings(options);

  const isXTemporal = isTemporalType(xColumn.type);

  const hasTemporalAggregation = Boolean(isXTemporal && xInterval);
  const series =
    metric === 'count'
      ? [
          {
            y: {count: null},
            label: 'Count',
            color: DEFAULT_CHART_FALLBACK_COLOR,
          },
        ]
      : yColumns.map(({color, column, aggregate}) => ({
          y: hasTemporalAggregation ? {[aggregate]: column.name} : column.name,
          label: getLegendLabel(
            {field: column.name, aggregate},
            hasTemporalAggregation,
          ),
          color,
        }));

  // Data source always includes filterBy for brush
  const dataSource = {
    from: getChartTableReference(dataTable),
    filterBy: '$brush',
  };

  const plotMarks: unknown[] = series.map(({y, color}) => ({
    mark: 'lineY',
    data: dataSource,
    x: hasTemporalAggregation
      ? {bin: xColumn.name, interval: xInterval}
      : xColumn.name,
    y,
    stroke: color,
  }));

  // Add brush control only if selectionName is provided
  if (selectionName) {
    plotMarks.push({select: 'intervalX', as: '$brush'});
  }

  const showLegend = settings.showLegend ?? true;

  const plotSpec = {
    plot: plotMarks,
    name: 'lineChart',
    xLabel: xColumn.name,
    yLabel: metric === 'count' ? 'Count' : undefined,
    margins: {
      left: 50,
      right: 20,
      top: 20,
      bottom: 50,
    },
    colorDomain: series.map(({label}) => label),
    colorRange: series.map(({color}) => color),
  };

  if (!showLegend) {
    return {
      ...plotSpec,
      params: {brush: {select: 'crossfilter'}},
    } as Spec;
  }

  return {
    vconcat: [
      plotSpec,
      {
        legend: 'color',
        for: 'lineChart',
        columns: series.length,
      },
    ],
    params: {brush: {select: 'crossfilter'}},
  } as Spec;
}
