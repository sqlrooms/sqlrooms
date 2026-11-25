import type {Spec} from '@uwdata/mosaic-spec';
import {column} from '@uwdata/mosaic-sql';
import {HistogramChartSettings} from './schema';
import {CreateSpecOptions, getChartTableReference} from '../base-types';
import {DEFAULT_CHART_FALLBACK_COLOR} from '../../../constants/chart-colors';
import {validateHistogramSettings} from './validation';
import {createHistogramPercentileQueries} from './percentile';

const BG_COLOR = 'var(--color-chart-overlay)';
const DEFAULT_FG_COLOR = DEFAULT_CHART_FALLBACK_COLOR;

export function createHistogramSpec(
  options: CreateSpecOptions<HistogramChartSettings>,
  cutoff?: string,
): Spec {
  const {dataTable, selectionName, settings} = options;

  const {fieldColumn, maxBins} = validateHistogramSettings(options);
  const fgColor = settings.color ?? DEFAULT_FG_COLOR;
  const percentile = getHistogramUpperPercentile(settings);
  const source =
    percentile === undefined
      ? getChartTableReference(dataTable)
      : createHistogramPercentileQueries(
          dataTable.table,
          fieldColumn,
          percentile,
        ).source(cutoff);
  const field =
    percentile === undefined ? fieldColumn.name : column(fieldColumn.name);

  const plot: unknown[] = [
    {
      mark: 'rectY',
      data: {from: source},
      x: {bin: field, steps: maxBins},
      y: {count: null},
      fill: BG_COLOR,
      inset: 0.5,
    },
    {
      mark: 'rectY',
      data: {from: source, filterBy: '$brush'},
      x: {bin: field, steps: maxBins},
      y: {count: null},
      fill: fgColor,
      inset: 0.5,
    },
  ];

  if (selectionName) {
    plot.push(
      percentile === undefined
        ? {select: 'intervalX', as: '$brush'}
        : {select: 'intervalX', as: '$brush', field},
    );
  }

  return {
    plot,
    xLabel:
      percentile === undefined
        ? fieldColumn.name
        : `${fieldColumn.name} (through P${percentile})`,
    yLabel: 'Count',

    margins: {left: 50, right: 20, top: 20, bottom: 50},
    params: {brush: {select: 'crossfilter'}},
  } as Spec;
}

/** Return the configured clipping percentile, or undefined for the full range. */
export function getHistogramUpperPercentile(
  settings: HistogramChartSettings,
): number | undefined {
  const percentile = HistogramChartSettings.shape.upperPercentile.parse(
    settings.upperPercentile,
  );
  return percentile != null && percentile < 100 ? percentile : undefined;
}
