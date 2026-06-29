import type {RoomPanelComponent} from '@sqlrooms/layout';
import {useCallback, useMemo} from 'react';
import {
  SelectablePanelWrapper,
  useBlockSettingsStore,
} from '@sqlrooms/documents';
import {MosaicDashboardPanelErrorBoundary} from './MosaicDashboardPanelErrorBoundary';
import {MosaicDashboardPanelHeader} from './MosaicDashboardPanelHeader';
import {
  getMosaicDashboardSelectionName,
  useStoreWithMosaicDashboard,
} from '../MosaicDashboardSlice';
import {useMosaicDashboardContext} from '../MosaicDashboardContext';

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
  const selectBlock = useBlockSettingsStore(
    (state) => state.blockSettings.selectBlock,
  );
  const updatePanel = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.updatePanel,
  );

  const panel = useMemo(
    () =>
      panelId
        ? dashboard?.panels.find((candidate) => candidate.id === panelId)
        : undefined,
    [dashboard?.panels, panelId],
  );
  const renderer = panel ? panelRenderers[panel.type] : undefined;
  const handleSelectPanel = useCallback(() => {
    if (!panel) return;

    selectBlock({
      type: 'dashboard-panel',
      id: panel.id,
      dashboardId,
      panelType: panel.type,
      settingsComponent: renderer?.settings,
    });
  }, [dashboardId, panel, renderer?.settings, selectBlock]);
  const handleTitleChange = useCallback(
    (title: string) => {
      if (!panel) return;

      updatePanel(dashboardId, panel.id, {title: title || undefined});
    },
    [dashboardId, panel, updatePanel],
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
    <SelectablePanelWrapper
      dashboardId={dashboardId}
      panelId={panel.id}
      panelType={panel.type}
      blockType="dashboard-panel"
      settingsComponent={renderer?.settings}
    >
      <div className="flex h-full flex-col">
        <MosaicDashboardPanelHeader
          dashboardId={dashboardId}
          dashboard={dashboard}
          panel={panel}
          renderer={renderer}
          selectionName={selectionName}
          onSelectPanel={handleSelectPanel}
          onTitleChange={handleTitleChange}
        />

        <div className="min-h-0 flex-1 overflow-hidden">
          <MosaicDashboardPanelErrorBoundary
            key={dashboard?.selectedTable ?? ''}
            panelType={panel.type}
          >
            {RendererComponent ? (
              <RendererComponent
                dashboardId={dashboardId}
                dashboard={dashboard}
                panel={panel}
                selectionName={selectionName}
              />
            ) : (
              <div className="text-muted-foreground flex h-full items-center justify-center p-4 text-sm">
                Unsupported dashboard panel type: {panel.type}
              </div>
            )}
          </MosaicDashboardPanelErrorBoundary>
        </div>
      </div>
    </SelectablePanelWrapper>
  );
};
