import type {Spec} from '@uwdata/mosaic-spec';
import {CountPlotChartSettings} from './schema';
import {CreateSpecOptions} from '../base-types';
import {getChartTableReference} from '../utils';
import {validateCountPlotSettings} from './validation';

const BG_COLOR = 'var(--color-chart-overlay)';
const FG_COLOR = 'var(--color-chart-1)';

export function createCountPlotSpec(
  options: CreateSpecOptions<CountPlotChartSettings>,
): Spec {
  const {dataTable, selectionName} = options;

  const {fieldColumn} = validateCountPlotSettings(options);
  const tableReference = getChartTableReference(dataTable);

  // Count plot shows categorical frequency as horizontal bars
  // Categories on Y-axis, counts on X-axis
  const plot: unknown[] = [
    {
      mark: 'barX',
      data: {from: tableReference},
      x: {count: null},
      y: {
        column: fieldColumn.name,
        sort: {x: 'sum', order: 'desc', limit: 100},
      },
      fill: BG_COLOR,
      inset: 0.5,
    },
    {
      mark: 'barX',
      data: {from: tableReference, filterBy: '$brush'},
      x: {count: null},
      y: {
        column: fieldColumn.name,
        sort: {x: 'sum', order: 'desc', limit: 100},
      },
      fill: FG_COLOR,
      inset: 0.5,
    },
    {
      mark: 'text',
      data: {from: tableReference, filterBy: '$brush'},
      x: {count: null},
      y: {
        column: fieldColumn.name,
        sort: {x: 'sum', order: 'desc', limit: 100},
      },
      text: {count: null},
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
    xLabel: 'Count',
    yLabel: fieldColumn.name,
    height: 400,
    width: 380,
    margins: {left: 50, right: 50, top: 20, bottom: 50},
    params: {brush: {select: 'crossfilter'}},
  } as Spec;
}
