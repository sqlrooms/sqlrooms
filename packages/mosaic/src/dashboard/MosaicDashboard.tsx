import {createId} from '@paralleldrive/cuid2';
import React, {
  PropsWithChildren,
  ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type {ChartBuilderColumn} from '../chart-builders/types';
import {MosaicChartBuilder} from '../MosaicChartBuilder';
import type {Spec} from '@uwdata/mosaic-spec';
import {MosaicDashboardContext} from './MosaicDashboardContext';
import {MosaicDashboardCharts} from './MosaicDashboardCharts';
import {MosaicDashboardProfiler} from './MosaicDashboardProfiler';
import {
  type MosaicDashboardChartConfig,
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
  const addChart = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.addChart,
  );
  const setSelectedTable = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.setSelectedTable,
  );
  const dashboard = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.config.dashboardsById[dashboardId],
  );
  const tables = useStoreWithMosaicDashboard((state) => state.db.tables);
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
      const newChart: MosaicDashboardChartConfig = {
        id: createId(),
        title,
        vgplot: JSON.parse(JSON.stringify(spec)) as Record<string, unknown>,
      };
      addChart(dashboardId, newChart);
      setBuilderOpen(false);
    },
    [addChart, dashboardId],
  );

  const contextValue = useMemo(
    () => ({
      dashboardId,
      builderOpen,
      canCreateChart: Boolean(dashboard?.selectedTable),
      openBuilder: () => setBuilderOpen(true),
      closeBuilder: () => setBuilderOpen(false),
      setBuilderOpen,
    }),
    [builderOpen, dashboard?.selectedTable, dashboardId],
  );

  return (
    <MosaicDashboardContext.Provider value={contextValue}>
      {children}
      {dashboard?.selectedTable ? (
        <MosaicChartBuilder.Dialog
          open={builderOpen}
          onOpenChange={setBuilderOpen}
          tableName={dashboard.selectedTable}
          columns={builderColumns}
          onCreateChart={handleCreateChart}
        />
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
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <MosaicDashboardProfiler />
          <MosaicDashboardCharts />
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
  Profiler: typeof MosaicDashboardProfiler;
  Charts: typeof MosaicDashboardCharts;
};

export const MosaicDashboard: MosaicDashboardCompoundComponent = Object.assign(
  MosaicDashboardComponent,
  {
    Root: MosaicDashboardRoot,
    Toolbar: MosaicDashboardToolbar,
    Profiler: MosaicDashboardProfiler,
    Charts: MosaicDashboardCharts,
  },
);
