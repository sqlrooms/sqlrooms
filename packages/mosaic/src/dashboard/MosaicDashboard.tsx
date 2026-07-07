import {
  PropsWithChildren,
  ReactElement,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {MosaicChartBuilder} from '../MosaicChartBuilder';
import {MosaicDashboardContext} from './MosaicDashboardContext';
import {MosaicDashboardPanels} from './panel/MosaicDashboardPanels';
import {
  SelectablePanelWrapper,
  useBlockSettingsStore,
} from '@sqlrooms/documents';
import {MOSAIC_DASHBOARD_CHART_PANEL_TYPE} from './dashboard-types';
import {
  createMosaicDashboardChartPanelConfig,
  useStoreWithMosaicDashboard,
} from './MosaicDashboardSlice';
import {MosaicDashboardToolbar} from './toolbar/MosaicDashboardToolbar';
import {ChartBuilderColumn} from '../charts/chart-types/base-types';
import {ChartConfig} from '../charts/chart-types/chart-config';
import {useSelectedOrFirstTable} from './useSelectedOrFirstTable';
import {MosaicDashboardSettings} from './MosaicDashboardSettings';
import {ScrollArea} from '@sqlrooms/ui';

export type MosaicDashboardRootProps = PropsWithChildren<{
  dashboardId: string;
  readOnly?: boolean;
  headerActions?: ReactNode;
}>;

export function MosaicDashboardRoot({
  children,
  dashboardId,
  headerActions,
  readOnly,
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
      readOnly,
      headerActions,
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
      readOnly,
      headerActions,
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
  /** Actions rendered at the end of the dashboard toolbar. */
  headerActions?: ReactNode;
  /** Whether to enable selection of the entire dashboard */
  selectable?: boolean;
  /** Whether settings for this dashboard should avoid mutating state. */
  readOnly?: boolean;
};

function MosaicDashboardComponent({
  dashboardId,
  headerActions,
  selectable = false,
  readOnly,
}: MosaicDashboardProps): ReactElement {
  const clearSelection = useBlockSettingsStore(
    (state) => state.blockSettings?.clearSelection,
  );

  const handleContainerClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;

      // Don't clear if clicking on a panel - SelectablePanelWrapper has data-selectable-panel
      const isPanel = target.closest('[data-selectable-panel]');
      if (isPanel) {
        return;
      }

      // Clear selection for clicks on toolbar, empty space, or layout elements
      clearSelection();
    },
    [clearSelection],
  );

  return (
    <MosaicDashboardRoot
      dashboardId={dashboardId}
      headerActions={headerActions}
      readOnly={readOnly}
    >
      {selectable ? (
        <SelectablePanelWrapper
          dashboardId={dashboardId}
          panelId={dashboardId}
          panelType="dashboard"
          blockType="dashboard-block"
          className="flex flex-col"
          settingsComponent={MosaicDashboardSettings}
          readOnly={readOnly}
        >
          <MosaicDashboardToolbar />
          <ScrollArea className="min-h-0 flex-1 overflow-hidden [&_[data-radix-scroll-area-viewport]>div]:!block [&_[data-radix-scroll-area-viewport]>div]:!min-h-full">
            <MosaicDashboardPanels />
          </ScrollArea>
        </SelectablePanelWrapper>
      ) : (
        <div className="flex h-full flex-col" onClick={handleContainerClick}>
          <MosaicDashboardToolbar />
          <ScrollArea className="min-h-0 flex-1 overflow-hidden [&_[data-radix-scroll-area-viewport]>div]:!block [&_[data-radix-scroll-area-viewport]>div]:!min-h-full">
            <MosaicDashboardPanels />
          </ScrollArea>
        </div>
      )}
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
