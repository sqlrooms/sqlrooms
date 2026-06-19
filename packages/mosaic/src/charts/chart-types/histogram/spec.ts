import type {Spec} from '@uwdata/mosaic-spec';
import {HistogramChartSettings} from './schema';
import {CreateSpecOptions, getChartTableReference} from '../base-types';
import {DEFAULT_CHART_FALLBACK_COLOR} from '../../../constants/chart-colors';
import {validateHistogramSettings} from './validation';

const BG_COLOR = 'var(--color-chart-overlay)';
const DEFAULT_FG_COLOR = DEFAULT_CHART_FALLBACK_COLOR;

export function createHistogramSpec(
  options: CreateSpecOptions<HistogramChartSettings>,
): Spec {
  const {dataTable, selectionName, settings} = options;

  const {fieldColumn, maxBins} = validateHistogramSettings(options);
  const fgColor = settings.color ?? DEFAULT_FG_COLOR;
  const tableReference = getChartTableReference(dataTable);

  const plot: unknown[] = [
    {
      mark: 'rectY',
      data: {from: tableReference},
      x: {bin: fieldColumn.name, steps: maxBins},
      y: {count: null},
      fill: BG_COLOR,
      inset: 0.5,
    },
    {
      mark: 'rectY',
      data: {from: tableReference, filterBy: '$brush'},
      x: {bin: fieldColumn.name, steps: maxBins},
      y: {count: null},
      fill: fgColor,
      inset: 0.5,
    },
  ];

  if (selectionName) {
    plot.push({select: 'intervalX', as: '$brush'});
  }

  return {
    plot,
    xLabel: fieldColumn.name,
    yLabel: 'Count',

    margins: {left: 50, right: 20, top: 20, bottom: 50},
    params: {brush: {select: 'crossfilter'}},
  } as Spec;
}
