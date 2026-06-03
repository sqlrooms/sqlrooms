import type {Spec} from '@uwdata/mosaic-spec';
import {HeatmapChartSettings} from './schema';
import {ChartSpecError} from '../errors';

export function createHeatmapSpec(
  tableName: string,
  {x, y}: HeatmapChartSettings,
): Spec {
  if (!x) {
    throw new ChartSpecError('X field is required for heatmap');
  }
  if (!y) {
    throw new ChartSpecError('Y field is required for heatmap');
  }
  return {
    plot: [
      {
        mark: 'raster',
        data: {from: tableName, filterBy: '$brush'},
        x,
        y,
        fill: 'density',
        bandwidth: 0,
        pixelSize: 3,
      },
      {select: 'intervalXY', as: '$brush'},
    ],
    colorScale: 'sqrt',
    colorScheme: 'ylorrd',
    xLabel: x,
    yLabel: y,
    height: 250,
    width: 380,
    margins: {left: 50, right: 20, top: 20, bottom: 50},
    params: {brush: {select: 'crossfilter'}},
  } as Spec;
}
