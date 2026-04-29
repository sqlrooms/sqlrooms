import {LeafLayout} from '@sqlrooms/layout';
import {Button} from '@sqlrooms/ui';
import {GripVerticalIcon, Trash2Icon} from 'lucide-react';
import {FC, useCallback} from 'react';
import {
  type MosaicDashboardEntry,
  type MosaicDashboardPanelConfig,
  type MosaicDashboardPanelRenderer,
  type MosaicDashboardPanelRendererProps,
  type MosaicDashboardPanelSource,
  useStoreWithMosaicDashboard,
} from './MosaicDashboardSlice';

type MosaicDashboardPanelHeaderProps = {
  dashboardId: string;
  dashboard?: MosaicDashboardEntry;
  panel?: MosaicDashboardPanelConfig;
  renderer?: MosaicDashboardPanelRenderer;
  resolvedSource?: MosaicDashboardPanelSource;
  selectionName: string;
};

export const MosaicDashboardPanelHeader: FC<
  MosaicDashboardPanelHeaderProps
> = ({
  dashboardId,
  dashboard,
  panel,
  renderer,
  resolvedSource,
  selectionName,
}) => {
  const panelId = panel?.id;
  const removePanel = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.removePanel,
  );

  const handleRemove = useCallback(() => {
    if (!panelId) return;
    removePanel(dashboardId, panelId);
  }, [dashboardId, panelId, removePanel]);

  const title = panel?.title ?? 'Dashboard panel';
  const Icon = renderer?.icon;
  const HeaderActions = renderer?.headerActions;
  const rendererProps: MosaicDashboardPanelRendererProps | undefined =
    dashboard && panel
      ? {dashboardId, dashboard, panel, resolvedSource, selectionName}
      : undefined;

  return (
    <LeafLayout.Header>
      <div className="flex items-center justify-between border-b px-2 py-1">
        <LeafLayout.DragHandle className="flex min-w-0 flex-1 items-center gap-1">
          <GripVerticalIcon className="mx-1 h-4 w-4 shrink-0" />
          {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" /> : null}
          <span className="truncate text-xs font-medium">{title}</span>
        </LeafLayout.DragHandle>

        {panel && rendererProps ? (
          <div className="flex items-center gap-0.5">
            {HeaderActions ? <HeaderActions {...rendererProps} /> : null}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              title="Remove dashboard panel"
              onClick={handleRemove}
            >
              <Trash2Icon className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : null}
      </div>
    </LeafLayout.Header>
  );
};
