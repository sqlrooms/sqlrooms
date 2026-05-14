import {useMemo} from 'react';
import {useStoreWithMosaicDashboard} from '../dashboard/MosaicDashboardSlice';
import {ChartTypeDefinition} from './base-types';

export function useChartTypeDefinition(
  chartType: string | undefined,
): ChartTypeDefinition | undefined {
  const chartTypes = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.chartTypes,
  );

  // Find the chart type definition
  return useMemo(
    () => chartTypes?.find((type) => type.id === chartType),
    [chartTypes, chartType],
  );
}
