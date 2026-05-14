import {useMemo} from 'react';
import {useStoreWithMosaicDashboard} from '../dashboard/MosaicDashboardSlice';
import {RetainedVgPlotChart} from '../VgPlotChart';
import {ChartRetainer} from '../chart-types/base-types';

export function useChartRetainer(
  dashboardId: string,
  panelId: string,
): ChartRetainer {
  const retainedChart = useStoreWithMosaicDashboard((state) =>
    state.mosaicDashboard.getRetainedChart(dashboardId, panelId),
  );

  const setRetainedChart = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.setRetainedChart,
  );

  return useMemo(
    () => ({
      chart: retainedChart,
      setChart: (chart: RetainedVgPlotChart) =>
        setRetainedChart(dashboardId, panelId, chart),
    }),
    [dashboardId, panelId, retainedChart, setRetainedChart],
  );
}
