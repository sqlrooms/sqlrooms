import {Button, SpinnerPane} from '@sqlrooms/ui';
import type {Selection} from '@uwdata/mosaic-core';
import type {Spec} from '@uwdata/mosaic-spec';
import {BarChart3Icon} from 'lucide-react';
import {useCallback, useEffect, useMemo} from 'react';
import {VgPlotChart} from '../VgPlotChart';
import {VgPlotSpecPopoverEditor} from './VgPlotSpecPopoverEditor';
import {
  type MosaicDashboardPanelRenderer,
  type MosaicDashboardPanelRendererProps,
  useStoreWithMosaicDashboard,
} from './MosaicDashboardSlice';

function toRenderableMosaicSpec(
  parsedValue: Record<string, unknown>,
): Record<string, unknown> {
  const mosaicSpec = {...parsedValue};
  if ('$schema' in mosaicSpec) {
    delete mosaicSpec.$schema;
  }
  return mosaicSpec;
}

function getVgPlotSpec(panel: MosaicDashboardPanelRendererProps['panel']) {
  const spec = panel.config.vgplot;
  return spec && typeof spec === 'object' && !Array.isArray(spec)
    ? (spec as Record<string, unknown>)
    : null;
}

function MosaicDashboardVgPlotHeaderActions({
  dashboardId,
  panel,
}: MosaicDashboardPanelRendererProps) {
  const updatePanel = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.updatePanel,
  );
  const spec = getVgPlotSpec(panel);

  const handleSpecApply = useCallback(
    (newSpec: Record<string, unknown>) => {
      updatePanel(dashboardId, panel.id, {
        config: {...panel.config, vgplot: newSpec},
      });
    },
    [dashboardId, panel.config, panel.id, updatePanel],
  );

  if (!spec) {
    return (
      <Button variant="ghost" size="sm" className="h-6 px-2" disabled>
        Invalid spec
      </Button>
    );
  }

  return <VgPlotSpecPopoverEditor value={spec} onApply={handleSpecApply} />;
}

function MosaicDashboardVgPlotRenderer({
  dashboardId,
  panel,
  selectionName,
}: MosaicDashboardPanelRendererProps) {
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
  const vgplot = getVgPlotSpec(panel);
  const spec = vgplot
    ? (toRenderableMosaicSpec(vgplot) as unknown as Spec)
    : null;

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

  return (
    <div className="h-full min-h-0 overflow-auto p-2">
      {connection.status === 'loading' ? (
        <SpinnerPane className="h-full w-full" />
      ) : connection.status === 'ready' && spec && params ? (
        <div className="bg-background text-foreground flex h-full w-full items-center justify-center rounded-md p-2">
          <VgPlotChart spec={spec} params={params} retention={retention} />
        </div>
      ) : connection.status === 'ready' && spec ? (
        <SpinnerPane className="h-full w-full" />
      ) : (
        <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
          {connection.status === 'error'
            ? 'Mosaic connection failed'
            : 'No valid chart spec'}
        </div>
      )}
    </div>
  );
}

export const mosaicDashboardVgPlotPanelRenderer: MosaicDashboardPanelRenderer =
  {
    component: MosaicDashboardVgPlotRenderer,
    headerActions: MosaicDashboardVgPlotHeaderActions,
    icon: BarChart3Icon,
  };
