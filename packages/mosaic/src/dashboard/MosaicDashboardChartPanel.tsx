import type {RoomPanelComponent} from '@sqlrooms/layout';
import {Button, SpinnerPane} from '@sqlrooms/ui';
import type {Selection} from '@uwdata/mosaic-core';
import type {Spec} from '@uwdata/mosaic-spec';
import {Trash2Icon} from 'lucide-react';
import {useCallback, useMemo} from 'react';
import {VgPlotChart} from '../VgPlotChart';
import {useMosaicDashboardContext} from './MosaicDashboardContext';
import {
  getMosaicDashboardSelectionName,
  useStoreWithMosaicDashboard,
} from './MosaicDashboardSlice';
import {VgPlotSpecPopoverEditor} from './VgPlotSpecPopoverEditor';

function toRenderableMosaicSpec(
  parsedValue: Record<string, unknown>,
): Record<string, unknown> {
  const mosaicSpec = {...parsedValue};
  if ('$schema' in mosaicSpec) {
    delete mosaicSpec.$schema;
  }
  return mosaicSpec;
}

export const MosaicDashboardChartPanel: RoomPanelComponent = ({meta}) => {
  const {dashboardId} = useMosaicDashboardContext();
  const chartId = meta?.chartId as string | undefined;

  const dashboard = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.config.dashboardsById[dashboardId],
  );
  const connection = useStoreWithMosaicDashboard(
    (state) => state.mosaic.connection,
  );
  const updateChart = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.updateChart,
  );
  const removeChart = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.removeChart,
  );
  const getSelection = useStoreWithMosaicDashboard(
    (state) => state.mosaic.getSelection,
  );

  const chart = useMemo(
    () =>
      chartId
        ? dashboard?.charts.find((candidate) => candidate.id === chartId)
        : undefined,
    [chartId, dashboard?.charts],
  );

  const spec = chart?.vgplot
    ? (toRenderableMosaicSpec(chart.vgplot) as unknown as Spec)
    : null;
  const brushSelection = useMemo(
    () =>
      getSelection(getMosaicDashboardSelectionName(dashboardId), 'crossfilter'),
    [dashboardId, getSelection],
  );
  const params = useMemo(
    () => new Map<string, Selection>([['brush', brushSelection]]),
    [brushSelection],
  );

  const handleSpecApply = useCallback(
    (newVgplot: Record<string, unknown>) => {
      if (!chartId) return;
      updateChart(dashboardId, chartId, {vgplot: newVgplot});
    },
    [chartId, dashboardId, updateChart],
  );

  const handleRemove = useCallback(() => {
    if (!chartId) return;
    removeChart(dashboardId, chartId);
  }, [chartId, dashboardId, removeChart]);

  if (!chart) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
        Chart not found
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-2 py-1">
        <span className="truncate text-xs font-medium">{chart.title}</span>
        <div className="flex items-center gap-0.5">
          <VgPlotSpecPopoverEditor
            value={chart.vgplot}
            onApply={handleSpecApply}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title="Remove chart"
            onClick={handleRemove}
          >
            <Trash2Icon className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-2">
        {connection.status === 'loading' ? (
          <SpinnerPane className="h-full w-full" />
        ) : connection.status === 'ready' && spec ? (
          <div className="bg-background text-foreground inline-block min-w-full rounded-md p-2">
            <VgPlotChart spec={spec} params={params} />
          </div>
        ) : (
          <div className="text-muted-foreground text-sm">
            {connection.status === 'error'
              ? 'Mosaic connection failed'
              : 'No valid chart spec'}
          </div>
        )}
      </div>
    </div>
  );
};
