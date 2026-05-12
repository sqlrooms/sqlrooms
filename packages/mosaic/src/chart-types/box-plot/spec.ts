import type {Spec} from '@uwdata/mosaic-spec';
import {BoxPlotChartSettings} from './schema';
import {SpecGenerationError} from '../errors';

const FG_COLOR = 'var(--color-chart-1)';

export function createBoxPlotSpec(
  tableName: string,
  {x, y}: BoxPlotChartSettings,
): Spec {
  if (!x) {
    throw new SpecGenerationError('X field is required for box plot');
  }

  if (!y) {
    throw new SpecGenerationError('Y field is required for box plot');
  }

  return {
    plot: [
      {
        mark: 'boxY',
        data: {from: tableName, filterBy: '$brush'},
        x,
        y,
        fill: FG_COLOR,
      },
      {select: 'intervalX', as: '$brush'},
    ],
    xLabel: x,
    yLabel: y,
    height: 250,
    width: 380,
    margins: {left: 50, right: 20, top: 20, bottom: 50},
    params: {brush: {select: 'crossfilter'}},
  } as Spec;
}
