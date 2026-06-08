import type {Spec} from '@uwdata/mosaic-spec';
import {HistogramChartSettings, DEFAULT_BINS_COUNT} from './schema';
import {ChartSpecError} from '../errors';
import {CreateSpecOptions} from '../base-types';
import {validateFieldExists} from '../validation';

const BG_COLOR = 'var(--color-chart-overlay)';
const FG_COLOR = 'var(--color-chart-1)';

export function createHistogramSpec({
  dataTable,
  settings: {field, maxBins = DEFAULT_BINS_COUNT},
  selectionName,
}: CreateSpecOptions<HistogramChartSettings>): Spec {
  if (!field) {
    throw new ChartSpecError('Field is required for histogram');
  }

  validateFieldExists(dataTable, field, 'Field');

  const plot: unknown[] = [
    {
      mark: 'rectY',
      data: {from: dataTable.table.table},
      x: {bin: field, steps: maxBins},
      y: {count: null},
      fill: BG_COLOR,
      inset: 0.5,
    },
    {
      mark: 'rectY',
      data: {from: dataTable.table.table, filterBy: '$brush'},
      x: {bin: field, steps: maxBins},
      y: {count: null},
      fill: FG_COLOR,
      inset: 0.5,
    },
  ];

  if (selectionName) {
    plot.push({select: 'intervalX', as: '$brush'});
  }

  return {
    plot,
    xLabel: field,
    yLabel: 'Count',
    height: 200,
    width: 380,
    margins: {left: 50, right: 20, top: 20, bottom: 50},
    params: {brush: {select: 'crossfilter'}},
  } as Spec;
}
