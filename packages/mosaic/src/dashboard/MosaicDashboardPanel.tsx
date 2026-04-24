import type {RoomPanelComponent} from '@sqlrooms/layout';
import {useMemo} from 'react';
import {MosaicDashboardPanelHeader} from './MosaicDashboardPanelHeader';
import {
  getMosaicDashboardSelectionName,
  resolveMosaicDashboardPanelSource,
  useStoreWithMosaicDashboard,
} from './MosaicDashboardSlice';
import {useMosaicDashboardContext} from './MosaicDashboardContext';

export const MosaicDashboardPanel: RoomPanelComponent = ({meta}) => {
  const {dashboardId} = useMosaicDashboardContext();
  const panelId = meta?.panelId as string | undefined;

  const dashboard = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.config.dashboardsById[dashboardId],
  );
  const panelRenderers = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.panelRenderers,
  );
  const selectionName = getMosaicDashboardSelectionName(dashboardId);

  const panel = useMemo(
    () =>
      panelId
        ? dashboard?.panels.find((candidate) => candidate.id === panelId)
        : undefined,
    [dashboard?.panels, panelId],
  );
  const renderer = panel ? panelRenderers[panel.type] : undefined;
  const resolvedSource = useMemo(
    () =>
      dashboard && panel
        ? resolveMosaicDashboardPanelSource(dashboard, panel)
        : undefined,
    [dashboard, panel],
  );

  if (!dashboard || !panel) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
        Dashboard panel not found
      </div>
    );
  }

  const RendererComponent = renderer?.component;

  return (
    <div className="flex h-full flex-col">
      <MosaicDashboardPanelHeader
        dashboardId={dashboardId}
        dashboard={dashboard}
        panel={panel}
        renderer={renderer}
        resolvedSource={resolvedSource}
        selectionName={selectionName}
      />

      <div className="min-h-0 flex-1 overflow-hidden">
        {RendererComponent ? (
          <RendererComponent
            dashboardId={dashboardId}
            dashboard={dashboard}
            panel={panel}
            resolvedSource={resolvedSource}
            selectionName={selectionName}
          />
        ) : (
          <div className="text-muted-foreground flex h-full items-center justify-center p-4 text-sm">
            Unsupported dashboard panel type: {panel.type}
          </div>
        )}
      </div>
    </div>
  );
};
