import type {Spec} from '@uwdata/mosaic-spec';
import {BubbleChartSettings} from './schema';
import {SpecGenerationError} from '../errors';

const FG_COLOR = 'var(--color-chart-1)';

export function createBubbleChartSpec(
  tableName: string,
  {x, y}: BubbleChartSettings,
): Spec {
  if (!x) {
    throw new SpecGenerationError('X field is required for bubble chart');
  }
  if (!y) {
    throw new SpecGenerationError('Y field is required for bubble chart');
  }
  return {
    plot: [
      {
        mark: 'dot',
        data: {from: tableName, filterBy: '$brush'},
        x,
        y,
        fill: FG_COLOR,
        fillOpacity: 0.5,
        r: 3,
      },
      {select: 'intervalXY', as: '$brush'},
    ],
    xLabel: x,
    yLabel: y,
    height: 250,
    width: 380,
    margins: {left: 50, right: 20, top: 20, bottom: 50},
    params: {brush: {select: 'crossfilter'}},
  } as Spec;
}
