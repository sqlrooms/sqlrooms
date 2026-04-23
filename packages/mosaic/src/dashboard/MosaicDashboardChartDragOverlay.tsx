import {LayoutNode, isLayoutPanelNode} from '@sqlrooms/layout';
import {GripVerticalIcon} from 'lucide-react';
import {FC} from 'react';
import {useMosaicDashboardContext} from './MosaicDashboardContext';
import {useStoreWithMosaicDashboard} from './MosaicDashboardSlice';

interface MosaicDashboardChartDragOverlayProps {
  node: LayoutNode;
}

export const MosaicDashboardChartDragOverlay: FC<
  MosaicDashboardChartDragOverlayProps
> = ({node}) => {
  const {dashboardId} = useMosaicDashboardContext();
  const dashboard = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.config.dashboardsById[dashboardId],
  );

  const chartId = isLayoutPanelNode(node)
    ? (node.panel as {meta?: {chartId?: string}})?.meta?.chartId
    : undefined;

  const chart = chartId
    ? dashboard?.charts.find((c) => c.id === chartId)
    : undefined;

  const chartTitle = chart?.title ?? 'Chart';

  return (
    <div className="border-border bg-background text-foreground inline-flex items-center gap-1 border px-2 py-1 shadow-lg">
      <GripVerticalIcon className="mx-1 h-4 w-4 shrink-0" />
      <span className="truncate text-xs font-medium">{chartTitle}</span>
    </div>
  );
};
