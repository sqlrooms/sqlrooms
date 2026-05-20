import {Button} from '@sqlrooms/ui';
import {BarChart3, Map, TableProperties, Text} from 'lucide-react';
import {useCallback, useMemo} from 'react';
import {useMosaicDashboardContext} from './MosaicDashboardContext';
import {
  createMosaicDashboardProfilerPanelConfig,
  createMosaicDashboardTextPanelConfig,
  type MosaicDashboardAddPanelActionContext,
  MOSAIC_DASHBOARD_PROFILER_PANEL_TYPE,
  MOSAIC_DASHBOARD_TEXT_PANEL_TYPE,
  useStoreWithMosaicDashboard,
} from './MosaicDashboardSlice';

export const MosaicDashboardEmptyState: React.FC = () => {
  const {dashboardId, addDefaultChart, canCreateChart} =
    useMosaicDashboardContext();
  const dashboard = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.config.dashboardsById[dashboardId],
  );
  const addPanel = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.addPanel,
  );
  const panelRenderers = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.panelRenderers,
  );
  const addPanelActions = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.addPanelActions,
  );
  const tables = useStoreWithMosaicDashboard((state) => state.db.tables);

  const tablesWithColumns = useMemo(
    () => tables.filter((table) => table.columns && table.columns.length > 0),
    [tables],
  );

  const selectedTable = useMemo(
    () =>
      tablesWithColumns.find(
        (table) => table.tableName === dashboard?.selectedTable,
      ),
    [dashboard?.selectedTable, tablesWithColumns],
  );

  const canAddProfiler = Boolean(
    dashboard?.selectedTable &&
    panelRenderers[MOSAIC_DASHBOARD_PROFILER_PANEL_TYPE],
  );

  const canAddText = Boolean(panelRenderers[MOSAIC_DASHBOARD_TEXT_PANEL_TYPE]);

  const addPanelActionContext = useMemo<MosaicDashboardAddPanelActionContext>(
    () => ({
      dashboardId,
      dashboard,
      selectedTable,
      tables: tablesWithColumns,
    }),
    [dashboard, dashboardId, selectedTable, tablesWithColumns],
  );

  const mapAction = useMemo(
    () => addPanelActions.find((action) => action.label === 'Map'),
    [addPanelActions],
  );

  const canAddMap = Boolean(
    mapAction &&
    (mapAction.isEnabled ? mapAction.isEnabled(addPanelActionContext) : true),
  );

  const handleAddProfiler = useCallback(() => {
    const panel = dashboard?.selectedTable
      ? createMosaicDashboardProfilerPanelConfig({
          source: {tableName: dashboard.selectedTable},
        })
      : createMosaicDashboardProfilerPanelConfig();
    addPanel(dashboardId, panel);
  }, [addPanel, dashboard, dashboardId]);

  const handleAddMap = useCallback(() => {
    if (!mapAction) return;
    const panel = mapAction.createPanel(addPanelActionContext);
    if (panel) {
      addPanel(dashboardId, panel);
    }
  }, [addPanel, addPanelActionContext, dashboardId, mapAction]);

  const handleAddText = useCallback(() => {
    const panel = createMosaicDashboardTextPanelConfig();
    addPanel(dashboardId, panel);
  }, [addPanel, dashboardId]);

  return (
    <div className="m-4 flex min-h-[240px] items-center justify-center rounded-md border border-dashed p-8">
      <div className="flex flex-col items-center gap-4">
        <p className="text-muted-foreground text-sm">
          Add a chart, profiler, map, or text to start building this dashboard
        </p>
        <div className="flex gap-3">
          <Button
            variant="outline"
            disabled={!canCreateChart}
            onClick={addDefaultChart}
          >
            <BarChart3 className="mr-2 h-4 w-4" />
            Chart
          </Button>
          <Button
            variant="outline"
            disabled={!canAddProfiler}
            onClick={handleAddProfiler}
          >
            <TableProperties className="mr-2 h-4 w-4" />
            Profiler
          </Button>
          <Button
            variant="outline"
            disabled={!canAddMap}
            onClick={handleAddMap}
          >
            <Map className="mr-2 h-4 w-4" />
            Map
          </Button>
          <Button
            variant="outline"
            disabled={!canAddText}
            onClick={handleAddText}
          >
            <Text className="mr-2 h-4 w-4" />
            Text
          </Button>
        </div>
      </div>
    </div>
  );
};
