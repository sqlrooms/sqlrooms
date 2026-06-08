import type {Spec} from '@uwdata/mosaic-spec';
import {HeatmapChartSettings} from './schema';
import {ChartSpecError} from '../errors';
import {CreateSpecOptions} from '../base-types';
import {validateFieldExists} from '../validation';

export function createHeatmapSpec({
  dataTable,
  settings: {x, y},
  selectionName,
}: CreateSpecOptions<HeatmapChartSettings>): Spec {
  if (!x) {
    throw new ChartSpecError('X field is required for heatmap');
  }

  if (!y) {
    throw new ChartSpecError('Y field is required for heatmap');
  }

  validateFieldExists(dataTable, x, 'X field');
  validateFieldExists(dataTable, y, 'Y field');

  const plot: unknown[] = [
    {
      mark: 'raster',
      data: {from: dataTable.table.table, filterBy: '$brush'},
      x,
      y,
      fill: 'density',
      bandwidth: 0,
      pixelSize: 3,
    },
  ];

  if (selectionName) {
    plot.push({select: 'intervalXY', as: '$brush'});
  }

  return {
    plot,
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
