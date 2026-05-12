import {FC, useMemo} from 'react';
import {VgPlotChart} from '../../VgPlotChart';
import type {ChartRendererProps} from '../base-types';
import type {HeatmapChartConfig} from './schema';
import {createHeatmapSpec} from './spec';

/**
 * Renderer for heatmap chart type.
 * Generates vgPlot spec internally and renders via VgPlotChart.
 */
export const HeatmapRenderer: FC<ChartRendererProps<HeatmapChartConfig>> = ({
  tableName,
  config: {settings},
  params,
  retention,
}) => {
  const spec = useMemo(
    () => createHeatmapSpec(tableName, settings),
    [tableName, settings],
  );

  return <VgPlotChart spec={spec} params={params} retention={retention} />;
};
