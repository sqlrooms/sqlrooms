import {SpinnerPane} from '@sqlrooms/ui';
import type {Selection} from '@uwdata/mosaic-core';
import {BarChart3Icon} from 'lucide-react';
import React, {type FC, useCallback, useEffect, useMemo} from 'react';
import {ChartSettingsPanel} from './chart-settings';
import {MosaicDashboardPanelLayout} from './MosaicDashboardPanelLayout';
import {MosaicDashboardVgPlotHeaderActions} from './MosaicDashboardVgPlotHeaderActions';
import {
  type MosaicDashboardPanelRenderer,
  type VgPlotPanelConfig,
  type VgPlotPanelRendererProps,
  useStoreWithMosaicDashboard,
} from './MosaicDashboardSlice';
import {VgPlotChartConfig} from '../chart-types';

const MosaicDashboardVgPlotRenderer: FC<VgPlotPanelRendererProps> = ({
  dashboardId,
  panel,
  selectionName,
}) => {
  const connection = useStoreWithMosaicDashboard(
    (state) => state.mosaic.connection,
  );
  const brushSelection = useStoreWithMosaicDashboard(
    (state) => state.mosaic.selections[selectionName],
  );
  const getSelection = useStoreWithMosaicDashboard(
    (state) => state.mosaic.getSelection,
  );
  const retainedChart = useStoreWithMosaicDashboard((state) =>
    state.mosaicDashboard.getRetainedChart(dashboardId, panel.id),
  );
  const setRetainedChart = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.setRetainedChart,
  );
  const chartTypes = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.chartTypes,
  );

  const updatePanel = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.updatePanel,
  );
  const isSettingsOpen = panel.config.settingsOpen;

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      updatePanel(dashboardId, panel.id, {
        config: {...panel.config, settingsOpen: isOpen},
      });
    },
    [dashboardId, panel.config, panel.id, updatePanel],
  );

  useEffect(() => {
    if (!brushSelection) {
      getSelection(selectionName, 'crossfilter');
    }
  }, [brushSelection, getSelection, selectionName]);

  const params = useMemo(
    () =>
      brushSelection
        ? new Map<string, Selection>([['brush', brushSelection]])
        : undefined,
    [brushSelection],
  );

  const retention = useMemo(
    () => ({
      chart: retainedChart,
      setChart: (chart: NonNullable<typeof retainedChart>) =>
        setRetainedChart(dashboardId, panel.id, chart),
    }),
    [dashboardId, panel.id, retainedChart, setRetainedChart],
  );

  const tableName = panel.source?.tableName;

  // Find the chart type definition
  const chartTypeDef = useMemo(() => {
    return chartTypes?.find((type) => type.id === panel.config.chartType);
  }, [chartTypes, panel.config.chartType]);

  const handleSettingsChange = useCallback(
    (config: VgPlotChartConfig) => {
      updatePanel(dashboardId, panel.id, {
        config,
      });
    },
    [dashboardId, panel.id, updatePanel],
  );

  const settingsContent = (
    <ChartSettingsPanel
      tableName={tableName}
      config={panel.config}
      onChange={handleSettingsChange}
      onClose={() => handleOpenChange(false)}
    />
  );

  const chartContent = (
    <div className="h-full overflow-auto p-2">
      {connection.status === 'loading' ? (
        <SpinnerPane className="h-full w-full" />
      ) : connection.status === 'ready' &&
        tableName &&
        chartTypeDef?.renderer &&
        params ? (
        <div className="bg-background text-foreground flex h-full w-full items-center justify-center rounded-md p-2">
          {React.createElement(chartTypeDef.renderer, {
            tableName,
            settings: panel.config.settings,
            coordinator: connection.coordinator,
            params,
            retention,
          })}
        </div>
      ) : connection.status === 'ready' &&
        (!tableName || !chartTypeDef?.renderer) ? (
        <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
          {!tableName ? 'No table selected' : 'Chart renderer not found'}
        </div>
      ) : connection.status === 'ready' ? (
        <SpinnerPane className="h-full w-full" />
      ) : (
        <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
          {connection.status === 'error'
            ? 'Mosaic connection failed'
            : 'No valid chart renderer'}
        </div>
      )}
    </div>
  );

  return (
    <div className="h-full min-h-0">
      <MosaicDashboardPanelLayout
        isOpen={isSettingsOpen}
        onIsOpenChange={handleOpenChange}
        settings={settingsContent}
        content={chartContent}
      />
    </div>
  );
};

export const mosaicDashboardVgPlotPanelRenderer: MosaicDashboardPanelRenderer<VgPlotPanelConfig> =
  {
    component: MosaicDashboardVgPlotRenderer,
    headerActions: MosaicDashboardVgPlotHeaderActions,
    icon: BarChart3Icon,
  };
