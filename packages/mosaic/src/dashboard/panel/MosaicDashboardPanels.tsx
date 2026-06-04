import {
  isLayoutDockNode,
  isLayoutGridNode,
  LayoutNode,
  LayoutRenderer,
} from '@sqlrooms/layout';
import {useCallback, useEffect, useMemo} from 'react';
import {useMosaicDashboardContext} from '../MosaicDashboardContext';
import {MosaicDashboardPanelDragOverlay} from './MosaicDashboardPanelDragOverlay';
import {MosaicDashboardPanel} from './MosaicDashboardPanel';
import type {MosaicDashboardPanelConfig} from '../dashboard-types';
import {
  getMosaicDashboardDockId,
  MOSAIC_DASHBOARD_PANEL,
  useStoreWithMosaicDashboard,
} from '../MosaicDashboardSlice';
import {DataTableSelectorEmptyState} from '../../components/DataTableSelector';
import {useTablesWithColumns} from '../../hooks/useTablesWithColumns';
import type {DataTable} from '@sqlrooms/db';

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

  const tables = useTablesWithColumns();
  const selectedTable = useStoreWithMosaicDashboard(
    (state) =>
      state.mosaicDashboard.config.dashboardsById[dashboardId]?.selectedTable,
  );
  const setSelectedTable = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.setSelectedTable,
  );

  const handleTableChange = useCallback(
    (table: DataTable) => {
      setSelectedTable(dashboardId, table.table.toString());
    },
    [dashboardId, setSelectedTable],
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

  if (!selectedTable) {
    return (
      <DataTableSelectorEmptyState
        onChange={handleTableChange}
        tables={tables}
      />
    );
  }

  if (!panels.length || !rootLayout) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="text-muted-foreground text-sm">
          Dashboard is empty. Add a panel to get started.
        </div>
      </div>
    );
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
