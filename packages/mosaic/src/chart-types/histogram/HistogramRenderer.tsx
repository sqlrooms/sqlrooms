import {FC, useMemo} from 'react';
import {VgPlotChart} from '../../VgPlotChart';
import type {ChartRendererProps} from '../base-types';
import type {HistogramChartConfig} from './schema';
import {createHistogramSpec} from './spec';

/**
 * Renderer for histogram chart type.
 * Generates vgPlot spec internally and renders via VgPlotChart.
 */
export const HistogramRenderer: FC<
  ChartRendererProps<HistogramChartConfig>
> = ({tableName, config: {settings}, params, retention}) => {
  const spec = useMemo(
    () => createHistogramSpec(tableName, settings),
    [tableName, settings],
  );

  return <VgPlotChart spec={spec} params={params} retention={retention} />;
};
