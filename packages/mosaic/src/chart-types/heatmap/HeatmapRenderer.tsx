import React, {useMemo} from 'react';
import type {Spec} from '@uwdata/mosaic-spec';
import {VgPlotChart} from '../../VgPlotChart';
import type {ChartRendererProps} from '../base-types';
import type {HeatmapChartSettings} from './schema';

/**
 * Renderer for heatmap chart type.
 * Generates vgPlot spec internally and renders via VgPlotChart.
 */
export function HeatmapRenderer({
  tableName,
  settings,
}: ChartRendererProps<HeatmapChartSettings>) {
  const spec = useMemo((): Spec => {
    const {x, y} = settings;

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
  }, [tableName, settings]);

  return <VgPlotChart spec={spec} />;
}
