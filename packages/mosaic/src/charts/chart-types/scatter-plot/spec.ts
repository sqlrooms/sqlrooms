import type {Spec} from '@uwdata/mosaic-spec';
import {ScatterPlotChartSettings} from './schema';

import {validateScatterPlotSettings} from './validation';

import {CreateSpecOptions} from '../base-types';
import {getChartTableReference} from '../utils';

const FG_COLOR = 'var(--color-chart-1)';
const DEFAULT_POINT_SIZE = 3;

export function createScatterPlotSpec(
  options: CreateSpecOptions<ScatterPlotChartSettings>,
): Spec {
  const {dataTable, selectionName} = options;

  const {xColumn, yColumn, sizeColumn} = validateScatterPlotSettings(options);

  const dotMark: Record<string, unknown> = {
    mark: 'dot',
    data: {from: getChartTableReference(dataTable), filterBy: '$brush'},
    x: xColumn.name,
    y: yColumn.name,
    fill: FG_COLOR,
    fillOpacity: 0.5,
  };

  // If size column is provided, use it for point radius; otherwise use fixed size
  if (sizeColumn) {
    dotMark.r = sizeColumn.name;
  } else {
    dotMark.r = DEFAULT_POINT_SIZE;
  }

  const plot: unknown[] = [dotMark];

  if (selectionName) {
    plot.push({select: 'intervalXY', as: '$brush'});
  }

  return {
    plot,
    xLabel: xColumn.name,
    yLabel: yColumn.name,
    height: 250,
    width: 380,
    margins: {left: 50, right: 20, top: 20, bottom: 50},
    params: {brush: {select: 'crossfilter'}},
  } as Spec;
}
