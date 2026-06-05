import type {Spec} from '@uwdata/mosaic-spec';
import {BubbleChartSettings} from './schema';
import {ChartSpecError} from '../errors';
import {CreateSpecOptions} from '../base-types';

const FG_COLOR = 'var(--color-chart-1)';

export function createBubbleChartSpec({
  tableName,
  settings: {x, y},
  selectionName,
}: CreateSpecOptions<BubbleChartSettings>): Spec {
  if (!x) {
    throw new ChartSpecError('X field is required for bubble chart');
  }
  if (!y) {
    throw new ChartSpecError('Y field is required for bubble chart');
  }

  const plot: unknown[] = [
    {
      mark: 'dot',
      data: {from: tableName, filterBy: '$brush'},
      x,
      y,
      fill: FG_COLOR,
      fillOpacity: 0.5,
      r: 3,
    },
  ];

  if (selectionName) {
    plot.push({select: 'intervalXY', as: '$brush'});
  }

  return {
    plot,
    xLabel: x,
    yLabel: y,
    height: 250,
    width: 380,
    margins: {left: 50, right: 20, top: 20, bottom: 50},
    params: {brush: {select: 'crossfilter'}},
  } as Spec;
}
