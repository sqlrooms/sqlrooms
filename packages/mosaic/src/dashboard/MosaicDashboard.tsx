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
import {MosaicDashboardPanels} from './panel/MosaicDashboardPanels';
import {MOSAIC_DASHBOARD_CHART_PANEL_TYPE} from './dashboard-types';
import {
  createMosaicDashboardChartPanelConfig,
  useStoreWithMosaicDashboard,
} from './MosaicDashboardSlice';
import {MosaicDashboardToolbar} from './toolbar/MosaicDashboardToolbar';
import {ChartBuilderColumn} from '../charts/chart-types/base-types';
import {ChartConfig} from '../charts/chart-types/chart-config';
import {useSelectedOrFirstTable} from './useSelectedOrFirstTable';

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

  const chartTypes = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.chartTypes,
  );

  const panelRenderers = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.panelRenderers,
  );

  const [builderOpen, setBuilderOpen] = useState(false);

  const selectedTableInfo = useSelectedOrFirstTable(dashboardId);

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

  const handleCreateChart = useCallback(
    (title: string, config: ChartConfig) => {
      const panel = createMosaicDashboardChartPanelConfig(title, config);
      addPanel(dashboardId, panel);
      setBuilderOpen(false);
    },
    [addPanel, dashboardId],
  );

  const handleAddDefaultChart = useCallback(() => {
    // Create chart panel with default field or empty if no numeric columns
    const panel = createMosaicDashboardChartPanelConfig('New Chart', {
      chartType: 'histogram',
      settings: {},
      settingsOpen: true, // Open settings by default
    });

    addPanel(dashboardId, panel);
  }, [addPanel, dashboardId]);

  const contextValue = useMemo(
    () => ({
      dashboardId,
      builderOpen,
      canCreateChart: Boolean(
        selectedTableInfo &&
        panelRenderers[MOSAIC_DASHBOARD_CHART_PANEL_TYPE] &&
        (chartTypes?.length ?? 0) !== 0,
      ),
      openBuilder: () => setBuilderOpen(true),
      closeBuilder: () => setBuilderOpen(false),
      setBuilderOpen,
      addDefaultChart: handleAddDefaultChart,
    }),
    [
      dashboardId,
      builderOpen,
      selectedTableInfo,
      panelRenderers,
      chartTypes?.length,
      handleAddDefaultChart,
    ],
  );

  return (
    <MosaicDashboardContext.Provider value={contextValue}>
      {children}
      {selectedTableInfo ? (
        <MosaicChartBuilder
          open={builderOpen}
          onOpenChange={setBuilderOpen}
          tableName={selectedTableInfo.table.table}
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
