import {FC, useMemo} from 'react';
import {VgPlotChart} from '../../VgPlotChart';
import type {ChartRendererProps} from '../base-types';
import type {LineChartConfig} from './schema';
import {createLineChartSpec} from './spec';

/**
 * Renderer for line chart type.
 * Generates vgPlot spec internally and renders via VgPlotChart.
 */
export const LineChartRenderer: FC<ChartRendererProps<LineChartConfig>> = ({
  tableName,
  config: {settings},
  params,
  retention,
}) => {
  const spec = useMemo(
    () => createLineChartSpec(tableName, settings),
    [tableName, settings],
  );

  return <VgPlotChart spec={spec} params={params} retention={retention} />;
};
