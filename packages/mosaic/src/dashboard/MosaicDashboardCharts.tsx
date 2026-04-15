import {
  isLayoutMosaicNode,
  LayoutMosaicNode,
  LayoutNode,
  LayoutRenderer,
} from '@sqlrooms/layout';
import {Button} from '@sqlrooms/ui';
import React, {useCallback, useEffect, useMemo} from 'react';
import {Plus} from 'lucide-react';
import {useMosaicDashboardContext} from './MosaicDashboardContext';
import {
  getMosaicDashboardMosaicId,
  getMosaicDashboardPanelId,
  useStoreWithMosaicDashboard,
} from './MosaicDashboardSlice';
import {MosaicDashboardChartPanel} from './MosaicDashboardChartPanel';

export const MosaicDashboardCharts: React.FC = () => {
  const {dashboardId, canCreateChart, openBuilder} =
    useMosaicDashboardContext();
  const dashboard = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.config.dashboardsById[dashboardId],
  );
  const registerPanel = useStoreWithMosaicDashboard(
    (state) => state.layout.registerPanel,
  );
  const unregisterPanel = useStoreWithMosaicDashboard(
    (state) => state.layout.unregisterPanel,
  );
  const setLayout = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.setLayout,
  );

  const charts = useMemo(() => dashboard?.charts ?? [], [dashboard?.charts]);

  useEffect(() => {
    const registeredIds: string[] = [];

    for (const chart of charts) {
      const panelId = getMosaicDashboardPanelId(dashboardId, chart.id);
      registerPanel(panelId, {
        title: chart.title,
        component: MosaicDashboardChartPanel,
      });
      registeredIds.push(panelId);
    }

    return () => {
      for (const id of registeredIds) {
        unregisterPanel(id);
      }
    };
  }, [charts, dashboardId, registerPanel, unregisterPanel]);

  const mosaicNode: LayoutMosaicNode = useMemo(
    () => ({
      type: 'mosaic',
      id: getMosaicDashboardMosaicId(dashboardId),
      layout: dashboard?.layout ?? null,
    }),
    [dashboard?.layout, dashboardId],
  );

  const handleLayoutChange = useCallback(
    (nextLayout: LayoutNode | null) => {
      setLayout(
        dashboardId,
        nextLayout && isLayoutMosaicNode(nextLayout) ? nextLayout.layout : null,
      );
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

  return (
    <div className="min-h-0 flex-1">
      <LayoutRenderer
        rootLayout={mosaicNode}
        onLayoutChange={handleLayoutChange}
      />
    </div>
  );
};
