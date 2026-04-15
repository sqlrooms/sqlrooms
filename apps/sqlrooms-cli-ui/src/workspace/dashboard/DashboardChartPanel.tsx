import {useCellsStore} from '@sqlrooms/cells';
import type {RoomPanelComponent} from '@sqlrooms/layout';
import {useLayoutNodeContext} from '@sqlrooms/layout';
import {VgPlotChart} from '@sqlrooms/mosaic';
import type {Spec} from '@sqlrooms/mosaic';
import {Button, SpinnerPane} from '@sqlrooms/ui';
import {Trash2Icon} from 'lucide-react';
import React, {useCallback, useMemo} from 'react';
import {useRoomStore} from '../../store';
import {VgPlotSpecPopoverEditor} from './VgPlotSpecPopoverEditor';

function toRenderableMosaicSpec(
  parsedValue: Record<string, unknown>,
): Record<string, unknown> {
  const mosaicSpec = {...parsedValue};
  if ('$schema' in mosaicSpec) {
    delete mosaicSpec.$schema;
  }
  return mosaicSpec;
}

export const DashboardChartPanel: RoomPanelComponent = () => {
  const ctx = useLayoutNodeContext();
  const chartId = ctx.panelId;

  const currentSheetId = useCellsStore((s) => s.cells.config.currentSheetId);
  const mosaicConnection = useRoomStore((s) => s.mosaic.connection);

  const charts = useRoomStore((s) =>
    currentSheetId
      ? s.dashboard.config.dashboardsBySheetId[currentSheetId]?.charts
      : undefined,
  );
  const chart = useMemo(
    () => charts?.find((c) => c.id === chartId),
    [charts, chartId],
  );

  const updateChart = useRoomStore((s) => s.dashboard.updateChart);
  const removeChart = useRoomStore((s) => s.dashboard.removeChart);

  const spec = useMemo(() => {
    if (!chart?.vgplot) return null;
    try {
      const parsed = JSON.parse(chart.vgplot) as Record<string, unknown>;
      return toRenderableMosaicSpec(parsed) as unknown as Spec;
    } catch {
      return null;
    }
  }, [chart?.vgplot]);

  const handleSpecApply = useCallback(
    (newVgplot: string) => {
      if (!currentSheetId || !chartId) return;
      updateChart(currentSheetId, chartId, {vgplot: newVgplot});
    },
    [currentSheetId, chartId, updateChart],
  );

  const handleRemove = useCallback(() => {
    if (!currentSheetId || !chartId) return;
    removeChart(currentSheetId, chartId);
  }, [currentSheetId, chartId, removeChart]);

  if (!chart) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
        Chart not found
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-2 py-1">
        <span className="truncate text-xs font-medium">{chart.title}</span>
        <div className="flex items-center gap-0.5">
          <VgPlotSpecPopoverEditor
            value={chart.vgplot}
            onApply={handleSpecApply}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title="Remove chart"
            onClick={handleRemove}
          >
            <Trash2Icon className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-2">
        {mosaicConnection.status === 'loading' ? (
          <SpinnerPane className="h-full w-full" />
        ) : mosaicConnection.status === 'ready' && spec ? (
          <div className="inline-block min-w-full rounded-md bg-white p-2 text-black">
            <VgPlotChart spec={spec} />
          </div>
        ) : (
          <div className="text-muted-foreground text-sm">
            {mosaicConnection.status === 'error'
              ? 'Mosaic connection failed'
              : 'No valid chart spec'}
          </div>
        )}
      </div>
    </div>
  );
};
