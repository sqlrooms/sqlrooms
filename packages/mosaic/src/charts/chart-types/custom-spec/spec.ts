import {Spec} from '@uwdata/mosaic-spec';
import {CustomSpecChartSettings} from './schema';

export function createCustomSpec(
  tableName: string,
  {vgPlotSpec}: CustomSpecChartSettings,
): Spec {
  if (vgPlotSpec) {
    return vgPlotSpec as Spec;
  }

  // Default starter spec
  return {
    plot: [
      {
        mark: 'rectY',
        data: {from: tableName, filterBy: '$brush'},
        x: {bin: 'field_name', maxbins: 25},
        y: {count: null},
        fill: 'steelblue',
        inset: 0.5,
      },
      {select: 'intervalX', as: '$brush'},
    ],
    xLabel: 'field_name',
    height: 200,
    width: 380,
    params: {brush: {select: 'crossfilter'}},
  } as Spec;
}
