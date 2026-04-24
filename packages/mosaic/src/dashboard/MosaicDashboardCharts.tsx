import {
  isLayoutDockNode,
  LayoutDockNode,
  LayoutNode,
  LayoutRenderer,
} from '@sqlrooms/layout';
import {Button} from '@sqlrooms/ui';
import {Plus} from 'lucide-react';
import React, {useCallback, useEffect, useMemo} from 'react';
import {MosaicDashboardChartPanel} from './MosaicDashboardChartPanel';
import {MosaicDashboardChartDragOverlay} from './MosaicDashboardChartDragOverlay';
import {useMosaicDashboardContext} from './MosaicDashboardContext';
import {
  getMosaicDashboardDockId,
  MOSAIC_DASHBOARD_CHART_PANEL,
  useStoreWithMosaicDashboard,
} from './MosaicDashboardSlice';

export const MosaicDashboardCharts: React.FC = () => {
  const {dashboardId, canCreateChart, openBuilder} =
    useMosaicDashboardContext();
  const registerPanel = useStoreWithMosaicDashboard(
    (state) => state.layout.registerPanel,
  );
  const unregisterPanel = useStoreWithMosaicDashboard(
    (state) => state.layout.unregisterPanel,
  );
  const setLayout = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.setLayout,
  );

  const charts = useStoreWithMosaicDashboard(
    (state) =>
      state.mosaicDashboard.config.dashboardsById[dashboardId]?.charts ?? [],
  );
  const dashboardLayout = useStoreWithMosaicDashboard(
    (state) =>
      state.mosaicDashboard.config.dashboardsById[dashboardId]?.layout ?? null,
  );

  useEffect(() => {
    registerPanel(MOSAIC_DASHBOARD_CHART_PANEL, (context) => ({
      title: context.meta?.chartTitle as string | undefined,
      component: MosaicDashboardChartPanel,
      dragOverlay: MosaicDashboardChartDragOverlay,
    }));

    return () => {
      unregisterPanel(MOSAIC_DASHBOARD_CHART_PANEL);
    };
  }, [registerPanel, unregisterPanel]);

  const dockNode: LayoutDockNode | null = useMemo(() => {
    if (!dashboardLayout) return null;
    const dockId = getMosaicDashboardDockId(dashboardId);
    return {
      type: 'dock',
      id: dockId,
      panel: dockId,
      root: dashboardLayout,
    };
  }, [dashboardLayout, dashboardId]);

  const handleLayoutChange = useCallback(
    (nextLayout: LayoutNode | null) => {
      const innerRoot =
        nextLayout && isLayoutDockNode(nextLayout) ? nextLayout.root : null;
      setLayout(dashboardId, innerRoot);
    },
    [dashboardId, setLayout],
  );

  if (charts.length === 0) {
    return (
      <div className="text-muted-foreground flex h-64 flex-col items-center justify-center gap-2 text-sm">
        <p>No charts yet. Add one to get started.</p>
        <Button
          size="sm"
          variant="outline"
          onClick={openBuilder}
          disabled={!canCreateChart}
        >
          <Plus className="mr-1 h-4 w-4" />
          Add Chart
        </Button>
      </div>
    );
  }

  if (!dockNode) {
    return null;
  }

  return (
    <LayoutRenderer rootLayout={dockNode} onLayoutChange={handleLayoutChange} />
  );
};
