import {FC, useMemo} from 'react';
import {VgPlotChart} from '../../VgPlotChart';
import type {ChartRendererProps} from '../base-types';
import type {CustomSpecChartConfig} from './schema';
import {createCustomSpec} from './spec';

/**
 * Renderer for custom spec chart type.
 * Generates vgPlot spec internally and renders via VgPlotChart.
 */
export const CustomSpecRenderer: FC<
  ChartRendererProps<CustomSpecChartConfig>
> = ({tableName, params, retention, config: {settings}}) => {
  const spec = useMemo(
    () => createCustomSpec(tableName, settings),
    [tableName, settings],
  );

  return <VgPlotChart spec={spec} params={params} retention={retention} />;
};
