import React, {useMemo} from 'react';
import type {Spec} from '@uwdata/mosaic-spec';
import {VgPlotChart} from '../../VgPlotChart';
import type {ChartRendererProps} from '../base-types';
import type {HistogramChartSettings} from './schema';

const BG_COLOR = 'var(--color-chart-overlay)';
const FG_COLOR = 'var(--color-chart-1)';

/**
 * Renderer for histogram chart type.
 * Generates vgPlot spec internally and renders via VgPlotChart.
 */
export function HistogramRenderer({
  tableName,
  settings,
  params,
  retention,
}: ChartRendererProps<HistogramChartSettings>) {
  const spec = useMemo((): Spec => {
    const field = settings.field;

    return {
      plot: [
        {
          mark: 'rectY',
          data: {from: tableName},
          x: {bin: field, maxbins: 40},
          y: {count: null},
          fill: BG_COLOR,
          inset: 0.5,
        },
        {
          mark: 'rectY',
          data: {from: tableName, filterBy: '$brush'},
          x: {bin: field, maxbins: 40},
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
  }, [tableName, settings.field]);

  return <VgPlotChart spec={spec} params={params} retention={retention} />;
}
