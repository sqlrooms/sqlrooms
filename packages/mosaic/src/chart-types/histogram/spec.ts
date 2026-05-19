import type {Spec} from '@uwdata/mosaic-spec';
import {HistogramChartSettings, DEFAULT_BINS_COUNT} from './schema';
import {SpecGenerationError} from '../errors';

const BG_COLOR = 'var(--color-chart-overlay)';
const FG_COLOR = 'var(--color-chart-1)';

export function createHistogramSpec(
  tableName: string,
  {field, maxBins = DEFAULT_BINS_COUNT}: HistogramChartSettings,
): Spec {
  if (!field) {
    throw new SpecGenerationError('Field is required for histogram');
  }

  return {
    plot: [
      {
        mark: 'rectY',
        data: {from: tableName},
        x: {bin: field, steps: maxBins},
        y: {count: null},
        fill: BG_COLOR,
        inset: 0.5,
      },
      {
        mark: 'rectY',
        data: {from: tableName, filterBy: '$brush'},
        x: {bin: field, steps: maxBins},
        y: {count: null},
        fill: FG_COLOR,
        inset: 0.5,
      },
      {select: 'intervalX', as: '$brush'},
    ],
    xLabel: field,
    yLabel: 'Count',
    height: 200,
    width: 380,
    margins: {left: 50, right: 20, top: 20, bottom: 50},
    params: {brush: {select: 'crossfilter'}},
  } as Spec;
}
