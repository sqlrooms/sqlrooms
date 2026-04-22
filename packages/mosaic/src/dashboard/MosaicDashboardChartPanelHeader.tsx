import {Button} from '@sqlrooms/ui';
import {LeafLayout} from '@sqlrooms/layout';
import {GripVerticalIcon, Trash2Icon} from 'lucide-react';
import {FC, useCallback} from 'react';
import {useMosaicDashboardContext} from './MosaicDashboardContext';
import {
  MosaicDashboardChartConfig,
  useStoreWithMosaicDashboard,
} from './MosaicDashboardSlice';
import {VgPlotSpecPopoverEditor} from './VgPlotSpecPopoverEditor';

type MosaicDashboardChartPanelHeaderProps = {
  chart?: MosaicDashboardChartConfig;
};

export const MosaicDashboardChartPanelHeader: FC<
  MosaicDashboardChartPanelHeaderProps
> = ({chart}) => {
  const {dashboardId} = useMosaicDashboardContext();
  const chartId = chart?.id;

  const updateChart = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.updateChart,
  );

  const removeChart = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.removeChart,
  );

  const handleSpecApply = useCallback(
    (newSpec: Record<string, unknown>) => {
      if (!chartId) return;
      updateChart(dashboardId, chartId, {vgplot: newSpec});
    },
    [chartId, dashboardId, updateChart],
  );

  const handleRemove = useCallback(() => {
    if (!chartId) return;
    removeChart(dashboardId, chartId);
  }, [chartId, dashboardId, removeChart]);

  const title = chart ? chart.title : 'SSomething went wrong';

  return (
    <LeafLayout.Header>
      <div className="flex items-center justify-between border-b px-2 py-1">
        <LeafLayout.DragHandle className="flex min-w-0 flex-1 items-center gap-1">
          <GripVerticalIcon className="mx-1 h-4 w-4 shrink-0" />
          <span className="truncate text-xs font-medium">{title}</span>
        </LeafLayout.DragHandle>

        {chart && (
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
        )}
      </div>
    </LeafLayout.Header>
  );
};
