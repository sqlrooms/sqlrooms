import type {Spec} from '@uwdata/mosaic-spec';
import {HeatmapChartSettings} from './schema';
import {CreateSpecOptions} from '../base-types';
import {getChartTableReference} from '../utils';
import {validateHeatmapSettings} from './validation';

export function createHeatmapSpec(
  options: CreateSpecOptions<HeatmapChartSettings>,
): Spec {
  const {dataTable, selectionName} = options;

  const {xColumn, yColumn} = validateHeatmapSettings(options);

  const plot: unknown[] = [
    {
      mark: 'raster',
      data: {from: getChartTableReference(dataTable), filterBy: '$brush'},
      x: xColumn.name,
      y: yColumn.name,
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
    xLabel: xColumn.name,
    yLabel: yColumn.name,
    height: 250,
    width: 380,
    margins: {left: 50, right: 20, top: 20, bottom: 50},
    params: {brush: {select: 'crossfilter'}},
  } as Spec;
}
