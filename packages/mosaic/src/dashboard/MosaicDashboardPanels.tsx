import {
  isLayoutDockNode,
  isLayoutGridNode,
  LayoutNode,
  LayoutRenderer,
} from '@sqlrooms/layout';
import {useCallback, useEffect, useMemo} from 'react';
import {useMosaicDashboardContext} from './MosaicDashboardContext';
import {MosaicDashboardPanelDragOverlay} from './MosaicDashboardPanelDragOverlay';
import {MosaicDashboardPanel} from './MosaicDashboardPanel';
import type {MosaicDashboardPanelConfig} from './dashboard-types';
import {
  getMosaicDashboardDockId,
  MOSAIC_DASHBOARD_PANEL,
  useStoreWithMosaicDashboard,
} from './MosaicDashboardSlice';
import {MosaicDashboardInitialState} from './initial-state/MosaicDashboardInitialState';

const EMPTY_DASHBOARD_PANELS: MosaicDashboardPanelConfig[] = [];

export const MosaicDashboardPanels: React.FC = () => {
  const {dashboardId} = useMosaicDashboardContext();
  const registerPanel = useStoreWithMosaicDashboard(
    (state) => state.layout.registerPanel,
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
    // This renderer is shared by every Mosaic dashboard panel in the room.
    // Dashboard blocks can be transiently unmounted by the surrounding editor,
    // so unregistering on instance cleanup can leave still-mounted dashboards
    // with layout panel shells but no chart renderer.
    registerPanel(MOSAIC_DASHBOARD_PANEL, () => ({
      title: 'Dashboard panel',
      component: MosaicDashboardPanel,
      dragOverlay: MosaicDashboardPanelDragOverlay,
    }));
  }, [registerPanel]);

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

  const {onStart} = useMosaicDashboardContext();

  if (!panels.length || !rootLayout) {
    return <MosaicDashboardInitialState onStart={onStart} />;
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
