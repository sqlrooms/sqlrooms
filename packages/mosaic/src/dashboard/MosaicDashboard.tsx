import type {Spec} from '@uwdata/mosaic-spec';
import {
  PropsWithChildren,
  ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type {ChartBuilderColumn} from '../chart-builders/types';
import {MosaicChartBuilder} from '../MosaicChartBuilder';
import {MosaicDashboardContext} from './MosaicDashboardContext';
import {MosaicDashboardPanels} from './MosaicDashboardPanels';
import {
  createMosaicDashboardVgPlotPanelConfig,
  MOSAIC_DASHBOARD_VGPLOT_PANEL_TYPE,
  useStoreWithMosaicDashboard,
} from './MosaicDashboardSlice';
import {MosaicDashboardToolbar} from './MosaicDashboardToolbar';

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
  const chartBuilders = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.chartBuilders,
  );
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
    (spec: Spec, title: string) => {
      const panel = createMosaicDashboardVgPlotPanelConfig(spec, title);
      addPanel(dashboardId, panel);
      setBuilderOpen(false);
    },
    [addPanel, dashboardId],
  );

  const contextValue = useMemo(
    () => ({
      dashboardId,
      builderOpen,
      canCreateChart: Boolean(
        dashboard?.selectedTable &&
        panelRenderers[MOSAIC_DASHBOARD_VGPLOT_PANEL_TYPE] &&
        chartBuilders?.length !== 0 &&
        chartTypes?.length !== 0,
      ),
      openBuilder: () => setBuilderOpen(true),
      closeBuilder: () => setBuilderOpen(false),
      setBuilderOpen,
    }),
    [
      builderOpen,
      chartBuilders?.length,
      chartTypes?.length,
      dashboard?.selectedTable,
      dashboardId,
      panelRenderers,
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
          builders={chartBuilders}
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
