import React, {useMemo} from 'react';
import type {Spec} from '@uwdata/mosaic-spec';
import {VgPlotChart} from '../../VgPlotChart';
import type {ChartRendererProps} from '../base-types';
import type {CustomSpecChartSettings} from './schema';

/**
 * Renderer for custom spec chart type.
 * Generates vgPlot spec internally and renders via VgPlotChart.
 */
export function CustomSpecRenderer({
  tableName,
  params,
  retention,
}: ChartRendererProps<CustomSpecChartSettings>) {
  const spec = useMemo((): Spec => {
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
  }, [tableName]);

  return <VgPlotChart spec={spec} params={params} retention={retention} />;
}
