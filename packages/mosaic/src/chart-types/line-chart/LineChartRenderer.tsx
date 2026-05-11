import React, {useMemo} from 'react';
import type {Spec} from '@uwdata/mosaic-spec';
import {VgPlotChart} from '../../VgPlotChart';
import type {ChartRendererProps} from '../base-types';
import type {LineChartSettings} from './schema';

const FG_COLOR = 'var(--color-chart-1)';

/**
 * Renderer for line chart type.
 * Generates vgPlot spec internally and renders via VgPlotChart.
 */
export function LineChartRenderer({
  tableName,
  settings,
}: ChartRendererProps<LineChartSettings>) {
  const spec = useMemo((): Spec => {
    const {x, y} = settings;

    return {
      plot: [
        {
          mark: 'lineY',
          data: {from: tableName, filterBy: '$brush'},
          x,
          y,
          stroke: FG_COLOR,
        },
        {select: 'intervalX', as: '$brush'},
      ],
      xLabel: x,
      yLabel: y,
      height: 250,
      width: 380,
      margins: {left: 50, right: 20, top: 20, bottom: 50},
      params: {brush: {select: 'crossfilter'}},
    } as Spec;
  }, [tableName, settings]);

  return <VgPlotChart spec={spec} />;
}
