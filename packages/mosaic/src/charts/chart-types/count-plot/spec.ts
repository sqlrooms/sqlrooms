import type {Spec} from '@uwdata/mosaic-spec';
import {CountPlotChartSettings} from './schema';
import {ChartSpecError} from '../errors';

const BG_COLOR = 'var(--color-chart-overlay)';
const FG_COLOR = 'var(--color-chart-1)';

export function createCountPlotSpec(
  tableName: string,
  {field}: CountPlotChartSettings,
): Spec {
  if (!field) {
    throw new ChartSpecError('Field is required for count plot');
  }

  // Count plot shows categorical frequency as horizontal bars
  // Categories on Y-axis, counts on X-axis
  return {
    plot: [
      {
        mark: 'barX',
        data: {from: tableName},
        x: {count: null},
        y: {column: field, sort: {x: 'sum', order: 'desc', limit: 100}},
        fill: BG_COLOR,
        inset: 0.5,
      },
      {
        mark: 'barX',
        data: {from: tableName, filterBy: '$brush'},
        x: {count: null},
        y: {column: field, sort: {x: 'sum', order: 'desc', limit: 100}},
        fill: FG_COLOR,
        inset: 0.5,
      },
      {
        mark: 'text',
        data: {from: tableName, filterBy: '$brush'},
        x: {count: null},
        y: {column: field, sort: {x: 'sum', order: 'desc', limit: 100}},
        text: {count: null},
        dx: 5,
        textAnchor: 'start',
        fill: 'currentColor',
        fontSize: 11,
      },
      {select: 'intervalY', as: '$brush'},
    ],
    xLabel: 'Count',
    yLabel: field,
    height: 400,
    width: 380,
    margins: {left: 50, right: 50, top: 20, bottom: 50},
    params: {brush: {select: 'crossfilter'}},
  } as Spec;
}
