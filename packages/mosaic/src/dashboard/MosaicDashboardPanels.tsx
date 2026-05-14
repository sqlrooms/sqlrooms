import {
  isLayoutDockNode,
  isLayoutGridNode,
  LayoutNode,
  LayoutRenderer,
} from '@sqlrooms/layout';
import {useCallback, useEffect, useMemo} from 'react';
import {useMosaicDashboardContext} from './MosaicDashboardContext';
import {MosaicDashboardEmptyState} from './MosaicDashboardEmptyState';
import {MosaicDashboardPanelDragOverlay} from './MosaicDashboardPanelDragOverlay';
import {MosaicDashboardPanel} from './MosaicDashboardPanel';
import {
  getMosaicDashboardDockId,
  MOSAIC_DASHBOARD_PANEL,
  type MosaicDashboardPanelConfig,
  useStoreWithMosaicDashboard,
} from './MosaicDashboardSlice';

const EMPTY_DASHBOARD_PANELS: MosaicDashboardPanelConfig[] = [];

export const MosaicDashboardPanels: React.FC = () => {
  const {dashboardId} = useMosaicDashboardContext();
  const registerPanel = useStoreWithMosaicDashboard(
    (state) => state.layout.registerPanel,
  );
  const unregisterPanel = useStoreWithMosaicDashboard(
    (state) => state.layout.unregisterPanel,
  );
  const setLayout = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.setLayout,
  );
  const panels = useStoreWithMosaicDashboard(
    (state) =>
      state.mosaicDashboard.config.dashboardsById[dashboardId]?.panels ??
      EMPTY_DASHBOARD_PANELS,
  );
  const dashboardLayout = useStoreWithMosaicDashboard(
    (state) =>
      state.mosaicDashboard.config.dashboardsById[dashboardId]?.layout ?? null,
  );
  const dashboardLayoutType = useStoreWithMosaicDashboard(
    (state) =>
      state.mosaicDashboard.config.dashboardsById[dashboardId]?.layoutType ??
      'dock',
  );

  useEffect(() => {
    registerPanel(MOSAIC_DASHBOARD_PANEL, () => ({
      title: 'Dashboard panel',
      component: MosaicDashboardPanel,
      dragOverlay: MosaicDashboardPanelDragOverlay,
    }));
    return () => {
      unregisterPanel(MOSAIC_DASHBOARD_PANEL);
    };
  }, [registerPanel, unregisterPanel]);

  const rootLayout: LayoutNode | null = useMemo(() => {
    if (!dashboardLayout) return null;
    if (dashboardLayoutType === 'grid') {
      return isLayoutGridNode(dashboardLayout) ? dashboardLayout : null;
    }
    return {
      type: 'dock',
      id: getMosaicDashboardDockId(dashboardId),
      root: dashboardLayout,
    };
  }, [dashboardId, dashboardLayout, dashboardLayoutType]);

  const handleLayoutChange = useCallback(
    (nextLayout: LayoutNode | null) => {
      const innerLayout =
        nextLayout && isLayoutDockNode(nextLayout)
          ? nextLayout.root
          : nextLayout;
      setLayout(dashboardId, innerLayout);
    },
    [dashboardId, setLayout],
  );

  if (!panels.length || !rootLayout) {
    return <MosaicDashboardEmptyState />;
  }

  return (
    <div className="h-full min-h-[360px]">
      <LayoutRenderer
        rootLayout={rootLayout}
        onLayoutChange={handleLayoutChange}
      />
    </div>
  );
};
