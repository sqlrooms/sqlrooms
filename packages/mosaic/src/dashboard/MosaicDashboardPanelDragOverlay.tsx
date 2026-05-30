import {LayoutNode, isLayoutPanelNode} from '@sqlrooms/layout';
import {GripVerticalIcon} from 'lucide-react';
import {FC} from 'react';
import {useMosaicDashboardContext} from './MosaicDashboardContext';
import {useStoreWithMosaicDashboard} from './MosaicDashboardSlice';

interface MosaicDashboardPanelDragOverlayProps {
  node: LayoutNode;
}

export const MosaicDashboardPanelDragOverlay: FC<
  MosaicDashboardPanelDragOverlayProps
> = ({node}) => {
  const {dashboardId} = useMosaicDashboardContext();
  const dashboard = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.config.dashboardsById[dashboardId],
  );

  const panelId = isLayoutPanelNode(node)
    ? (node.panel as {meta?: {panelId?: string}})?.meta?.panelId
    : undefined;

  const panel = panelId
    ? dashboard?.panels.find((candidate) => candidate.id === panelId)
    : undefined;

  return (
    <div className="border-border bg-background text-foreground inline-flex items-center gap-1 border px-2 py-1 shadow-lg">
      <GripVerticalIcon className="mx-1 h-4 w-4 shrink-0" />
      <span className="truncate text-xs font-medium">
        {panel?.title ?? 'Dashboard panel'}
      </span>
    </div>
  );
};
