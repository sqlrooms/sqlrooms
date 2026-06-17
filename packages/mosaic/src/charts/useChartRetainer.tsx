import {useMemo} from 'react';
import {useStoreWithMosaicDashboard} from '../dashboard/MosaicDashboardSlice';
import {RetainedVgPlotChart} from '../VgPlotChart';
import {ChartRetainer} from './chart-types/base-types';

export function useChartRetainer(
  dashboardId: string,
  panelId: string,
): ChartRetainer {
  return useChartRetainerByKey(
    `dashboard:${dashboardId}:panel:${panelId}`,
  ) as ChartRetainer;
}

export function useChartRetainerByKey(
  retentionKey: string | undefined,
): ChartRetainer | undefined {
  const retainedChart = useStoreWithMosaicDashboard((state) =>
    retentionKey
      ? state.mosaicDashboard.getRetainedChartByKey(retentionKey)
      : undefined,
  );

  const setRetainedChart = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.setRetainedChartByKey,
  );

  return useMemo(
    () =>
      retentionKey
        ? {
            chart: retainedChart,
            setChart: (chart: RetainedVgPlotChart) =>
              setRetainedChart(retentionKey, chart),
          }
        : undefined,
    [retainedChart, retentionKey, setRetainedChart],
  );
}
