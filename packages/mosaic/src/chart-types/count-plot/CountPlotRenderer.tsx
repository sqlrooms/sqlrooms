import React, {useMemo} from 'react';
import {VgPlotChart} from '../../VgPlotChart';
import type {ChartRendererProps} from '../base-types';
import type {CountPlotChartConfig} from './schema';
import {createCountPlotSpec} from './spec';

/**
 * Renderer for count plot chart type.
 * Generates vgPlot spec internally and renders via VgPlotChart.
 */
export function CountPlotRenderer({
  tableName,
  config: {settings},
  params,
  retention,
}: ChartRendererProps<CountPlotChartConfig>) {
  const spec = useMemo(
    () => createCountPlotSpec(tableName, settings),
    [tableName, settings],
  );

  return <VgPlotChart spec={spec} params={params} retention={retention} />;
}
