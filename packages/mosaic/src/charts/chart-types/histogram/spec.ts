import type {Spec} from '@uwdata/mosaic-spec';
import {HistogramChartSettings} from './schema';
import {CreateSpecOptions} from '../base-types';
import {validateHistogramSettings} from './validation';

const BG_COLOR = 'var(--color-chart-overlay)';
const FG_COLOR = 'var(--color-chart-1)';

export function createHistogramSpec(
  options: CreateSpecOptions<HistogramChartSettings>,
): Spec {
  const {dataTable, selectionName} = options;

  const {fieldColumn, maxBins} = validateHistogramSettings(options);

  const plot: unknown[] = [
    {
      mark: 'rectY',
      data: {from: dataTable.table.table},
      x: {bin: fieldColumn.name, steps: maxBins},
      y: {count: null},
      fill: BG_COLOR,
      inset: 0.5,
    },
    {
      mark: 'rectY',
      data: {from: dataTable.table.table, filterBy: '$brush'},
      x: {bin: fieldColumn.name, steps: maxBins},
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
    xLabel: fieldColumn.name,
    yLabel: 'Count',

    margins: {left: 50, right: 20, top: 20, bottom: 50},
    params: {brush: {select: 'crossfilter'}},
  } as Spec;
}
