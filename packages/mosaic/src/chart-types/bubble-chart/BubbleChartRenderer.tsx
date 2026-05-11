import React, {useMemo} from 'react';
import type {Spec} from '@uwdata/mosaic-spec';
import {VgPlotChart} from '../../VgPlotChart';
import type {ChartRendererProps} from '../base-types';
import type {BubbleChartSettings} from './schema';

const FG_COLOR = 'var(--color-chart-1)';

/**
 * Renderer for bubble chart type.
 * Generates vgPlot spec internally and renders via VgPlotChart.
 */
export function BubbleChartRenderer({
  tableName,
  settings,
  params,
  retention,
}: ChartRendererProps<BubbleChartSettings>) {
  const spec = useMemo((): Spec => {
    const {x, y} = settings;

    return {
      plot: [
        {
          mark: 'dot',
          data: {from: tableName, filterBy: '$brush'},
          x,
          y,
          fill: FG_COLOR,
          fillOpacity: 0.5,
          r: 3,
        },
        {select: 'intervalXY', as: '$brush'},
      ],
      xLabel: x,
      yLabel: y,
      height: 250,
      width: 380,
      margins: {left: 50, right: 20, top: 20, bottom: 50},
      params: {brush: {select: 'crossfilter'}},
    } as Spec;
  }, [tableName, settings]);

  return <VgPlotChart spec={spec} params={params} retention={retention} />;
}
