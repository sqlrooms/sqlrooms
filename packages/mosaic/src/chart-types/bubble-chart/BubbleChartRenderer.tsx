import React, {useMemo} from 'react';
import {VgPlotChart} from '../../VgPlotChart';
import type {ChartRendererProps} from '../base-types';
import type {BubbleChartConfig} from './schema';
import {createBubbleChartSpec} from './spec';

/**
 * Renderer for bubble chart type.
 * Generates vgPlot spec internally and renders via VgPlotChart.
 */
export function BubbleChartRenderer({
  tableName,
  config: {settings},
  params,
  retention,
}: ChartRendererProps<BubbleChartConfig>) {
  const spec = useMemo(
    () => createBubbleChartSpec(tableName, settings),
    [tableName, settings],
  );

  return <VgPlotChart spec={spec} params={params} retention={retention} />;
}
