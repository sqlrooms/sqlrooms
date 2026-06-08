import {Spec} from '@uwdata/mosaic-spec';
import {CustomSpecChartSettings} from './schema';
import {CreateSpecOptions} from '../base-types';

export function createCustomSpec({
  dataTable,
  settings: {vgPlotSpec},
  selectionName,
}: CreateSpecOptions<CustomSpecChartSettings>): Spec {
  if (vgPlotSpec) {
    return vgPlotSpec as Spec;
  }

  // Default starter spec
  const plot: unknown[] = [
    {
      mark: 'rectY',
      data: {from: dataTable.table.table, filterBy: '$brush'},
      x: {bin: 'field_name', maxbins: 25},
      y: {count: null},
      fill: 'steelblue',
      inset: 0.5,
    },
  ];

  if (selectionName) {
    plot.push({select: 'intervalX', as: '$brush'});
  }

  return {
    plot,
    xLabel: 'field_name',
    height: 200,
    width: 380,
    params: {brush: {select: 'crossfilter'}},
  } as Spec;
}
