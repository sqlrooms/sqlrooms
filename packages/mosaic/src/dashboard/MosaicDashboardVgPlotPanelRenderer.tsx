import {SpinnerPane} from '@sqlrooms/ui';
import type {Selection} from '@uwdata/mosaic-core';
import type {Spec} from '@uwdata/mosaic-spec';
import {BarChart3Icon} from 'lucide-react';
import {type FC, useCallback, useEffect, useMemo} from 'react';
import {VgPlotChart} from '../VgPlotChart';
import {ChartSettingsPanel} from './chart-settings/ChartSettingsPanel';
import {MosaicDashboardPanelLayout} from './MosaicDashboardPanelLayout';
import {MosaicDashboardVgPlotHeaderActions} from './MosaicDashboardVgPlotHeaderActions';
import {
  type MosaicDashboardPanelRenderer,
  type VgPlotPanelConfig,
  type VgPlotPanelRendererProps,
  useStoreWithMosaicDashboard,
} from './MosaicDashboardSlice';
import {type VgPlotChartConfig} from '../chart-types/chart-config';
import {useGenerateSpec} from './useGenerateSpec';
import {ChartSpecErrorDisplay} from './ChartSpecErrorDisplay';

function toRenderableMosaicSpec(vgplot: unknown): Spec | null {
  try {
    if (!vgplot || typeof vgplot !== 'object' || Array.isArray(vgplot)) {
      return null;
    }

    const vgplotRecord = vgplot as Spec;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const {$schema, ...mosaicSpec} = vgplotRecord;

    return mosaicSpec;
  } catch (error) {
    console.error('[toRenderableMosaicSpec] Failed to parse spec:', error);
    return null;
  }
}

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

  // Generate spec using hook
  const {spec: generatedSpec, error: specError} = useGenerateSpec(
    panel.source?.tableName,
    panel.config.chartType,
    panel.config.settings,
  );

  // Apply toRenderableMosaicSpec
  const spec = useMemo(() => {
    return generatedSpec ? toRenderableMosaicSpec(generatedSpec) : null;
  }, [generatedSpec]);

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
      ) : connection.status === 'ready' && spec && params ? (
        <div className="bg-background text-foreground flex h-full w-full items-center justify-center rounded-md p-2">
          <VgPlotChart spec={spec} params={params} retention={retention} />
        </div>
      ) : connection.status === 'ready' && spec ? (
        <SpinnerPane className="h-full w-full" />
      ) : (
        <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-sm">
          {connection.status === 'error' ? (
            <>
              <div className="font-medium">Mosaic connection failed</div>
              <div className="text-xs">Check your database connection</div>
            </>
          ) : specError ? (
            <ChartSpecErrorDisplay error={specError} />
          ) : (
            'Configure chart settings to display visualization'
          )}
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
