import type {Spec} from '@uwdata/mosaic-spec';
import {EcdfChartSettings} from './schema';
import {SpecGenerationError} from '../errors';

const FG_COLOR = 'var(--color-chart-1)';

export function createEcdfSpec(
  tableName: string,
  {field}: EcdfChartSettings,
): Spec {
  if (!field) {
    throw new SpecGenerationError('Field is required for eCDF chart');
  }
  return {
    plot: [
      {
        mark: 'areaY',
        data: {from: tableName, filterBy: '$brush'},
        x: field,
        y: {sum: field, cumulative: true},
        fill: FG_COLOR,
        fillOpacity: 0.3,
      },
      {
        mark: 'lineY',
        data: {from: tableName, filterBy: '$brush'},
        x: field,
        y: {sum: field, cumulative: true},
        stroke: FG_COLOR,
      },
      {select: 'intervalX', as: '$brush'},
    ],
    xLabel: field,
    yLabel: 'Cumulative',
    height: 250,
    width: 380,
    margins: {left: 50, right: 20, top: 20, bottom: 50},
    params: {brush: {select: 'crossfilter'}},
  } as Spec;
}
