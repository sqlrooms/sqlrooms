import {
  PropsWithChildren,
  ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {MosaicChartBuilder} from '../MosaicChartBuilder';
import {MosaicDashboardContext} from './MosaicDashboardContext';
import {MosaicDashboardPanels} from './MosaicDashboardPanels';
import {MOSAIC_DASHBOARD_CHART_PANEL_TYPE} from './dashboard-types';
import {
  createMosaicDashboardChartPanelConfig,
  useStoreWithMosaicDashboard,
} from './MosaicDashboardSlice';
import {MosaicDashboardToolbar} from './MosaicDashboardToolbar';
import {ChartBuilderColumn} from '../chart-types/base-types';
import {ChartConfig} from '../chart-types/chart-config';

export type MosaicDashboardRootProps = PropsWithChildren<{
  dashboardId: string;
}>;

export function MosaicDashboardRoot({
  children,
  dashboardId,
}: MosaicDashboardRootProps) {
  const ensureDashboard = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.ensureDashboard,
  );
  const addPanel = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.addPanel,
  );
  const setSelectedTable = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.setSelectedTable,
  );
  const dashboard = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.config.dashboardsById[dashboardId],
  );
  const tables = useStoreWithMosaicDashboard((state) => state.db.tables);
  const chartTypes = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.chartTypes,
  );
  const panelRenderers = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.panelRenderers,
  );
  const [builderOpen, setBuilderOpen] = useState(false);

  const tablesWithColumns = useMemo(
    () => tables.filter((table) => table.columns && table.columns.length > 0),
    [tables],
  );

  const selectedTableInfo = useMemo(
    () =>
      tablesWithColumns.find(
        (table) => table.tableName === dashboard?.selectedTable,
      ),
    [dashboard?.selectedTable, tablesWithColumns],
  );

  const builderColumns: ChartBuilderColumn[] = useMemo(
    () =>
      selectedTableInfo?.columns?.map((column) => ({
        name: column.name,
        type: column.type,
      })) ?? [],
    [selectedTableInfo],
  );

  useEffect(() => {
    ensureDashboard(dashboardId);
  }, [dashboardId, ensureDashboard]);

  useEffect(() => {
    const firstTable = tablesWithColumns[0];
    if (!firstTable) return;
    const tableStillExists = tablesWithColumns.some(
      (table) => table.tableName === dashboard?.selectedTable,
    );
    if (!dashboard?.selectedTable || !tableStillExists) {
      setSelectedTable(dashboardId, firstTable.tableName);
    }
  }, [
    dashboard?.selectedTable,
    dashboardId,
    setSelectedTable,
    tablesWithColumns,
  ]);

  const handleCreateChart = useCallback(
    (title: string, config: ChartConfig) => {
      const panel = createMosaicDashboardChartPanelConfig(title, config, {
        tableName: dashboard?.selectedTable,
      });
      addPanel(dashboardId, panel);
      setBuilderOpen(false);
    },
    [addPanel, dashboard?.selectedTable, dashboardId],
  );

  const handleAddDefaultChart = useCallback(() => {
    if (!dashboard?.selectedTable) {
      return;
    }

    // Create chart panel with default field or empty if no numeric columns
    const panel = createMosaicDashboardChartPanelConfig(
      'New Chart',
      {
        chartType: 'histogram',
        settings: {},
        settingsOpen: true, // Open settings by default
      },
      {tableName: dashboard.selectedTable},
    );

    addPanel(dashboardId, panel);
  }, [addPanel, dashboard, dashboardId]);

  const contextValue = useMemo(
    () => ({
      dashboardId,
      builderOpen,
      canCreateChart: Boolean(
        dashboard?.selectedTable &&
        panelRenderers[MOSAIC_DASHBOARD_CHART_PANEL_TYPE] &&
        chartTypes?.length !== 0,
      ),
      openBuilder: () => setBuilderOpen(true),
      closeBuilder: () => setBuilderOpen(false),
      setBuilderOpen,
      addDefaultChart: handleAddDefaultChart,
    }),
    [
      builderOpen,
      chartTypes?.length,
      dashboard?.selectedTable,
      dashboardId,
      panelRenderers,
      handleAddDefaultChart,
    ],
  );

  return (
    <MosaicDashboardContext.Provider value={contextValue}>
      {children}
      {dashboard?.selectedTable ? (
        <MosaicChartBuilder
          open={builderOpen}
          onOpenChange={setBuilderOpen}
          tableName={dashboard.selectedTable}
          columns={builderColumns}
          chartTypes={chartTypes}
          onCreateChart={handleCreateChart}
        >
          <MosaicChartBuilder.Dialog />
        </MosaicChartBuilder>
      ) : null}
    </MosaicDashboardContext.Provider>
  );
}

export type MosaicDashboardProps = {
  dashboardId: string;
};

function MosaicDashboardComponent({
  dashboardId,
}: MosaicDashboardProps): ReactElement {
  return (
    <MosaicDashboardRoot dashboardId={dashboardId}>
      <div className="flex h-full flex-col">
        <MosaicDashboardToolbar />
        <div className="h-full overflow-y-auto">
          <MosaicDashboardPanels />
        </div>
      </div>
    </MosaicDashboardRoot>
  );
}

type MosaicDashboardCompoundComponent = ((
  props: MosaicDashboardProps,
) => ReactElement) & {
  Root: typeof MosaicDashboardRoot;
  Toolbar: typeof MosaicDashboardToolbar;
  Panels: typeof MosaicDashboardPanels;
};

export const MosaicDashboard: MosaicDashboardCompoundComponent = Object.assign(
  MosaicDashboardComponent,
  {
    Root: MosaicDashboardRoot,
    Toolbar: MosaicDashboardToolbar,
    Panels: MosaicDashboardPanels,
  },
);
