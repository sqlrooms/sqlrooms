import {useCellsStore} from '@sqlrooms/cells';
import {LayoutRenderer} from '@sqlrooms/layout';
import type {LayoutMosaicNode} from '@sqlrooms/layout';
import type {ChartBuilderColumn, Spec} from '@sqlrooms/mosaic';
import {MosaicChartBuilder} from '@sqlrooms/mosaic';
import {Button, SpinnerPane} from '@sqlrooms/ui';
import {Plus} from 'lucide-react';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {useRoomStore} from '../../store';
import type {DashboardChartConfig} from '../../store-types';
import {DashboardChartPanel} from './DashboardChartPanel';

const DASHBOARD_MOSAIC_ID = 'dashboard-mosaic';

export const DashboardSheet: React.FC = () => {
  const currentSheetId = useCellsStore((s) => s.cells.config.currentSheetId);
  const ensureSheetDashboard = useRoomStore(
    (s) => s.dashboard.ensureSheetDashboard,
  );
  const addChart = useRoomStore((s) => s.dashboard.addChart);
  const mosaicConnection = useRoomStore((s) => s.mosaic.connection);
  const registerPanel = useRoomStore((s) => s.layout.registerPanel);
  const unregisterPanel = useRoomStore((s) => s.layout.unregisterPanel);

  const charts = useRoomStore((s) =>
    currentSheetId
      ? s.dashboard.config.dashboardsBySheetId[currentSheetId]?.charts
      : undefined,
  );
  const tables = useRoomStore((s) => s.db.tables);

  const [builderOpen, setBuilderOpen] = useState(false);

  useEffect(() => {
    if (!currentSheetId) return;
    ensureSheetDashboard(currentSheetId);
  }, [currentSheetId, ensureSheetDashboard]);

  // Register a panel for each chart
  useEffect(() => {
    if (!charts) return;
    const registeredIds: string[] = [];
    for (const chart of charts) {
      registerPanel(chart.id, {
        title: chart.title,
        component: DashboardChartPanel,
      });
      registeredIds.push(chart.id);
    }
    return () => {
      for (const id of registeredIds) {
        unregisterPanel(id);
      }
    };
  }, [charts, registerPanel, unregisterPanel]);

  // Build the mosaic layout tree from the charts list
  const mosaicNode: LayoutMosaicNode = useMemo(() => {
    if (!charts || charts.length === 0) {
      return {
        type: 'mosaic' as const,
        id: DASHBOARD_MOSAIC_ID,
        layout: null,
      };
    }
    if (charts.length === 1) {
      return {
        type: 'mosaic' as const,
        id: DASHBOARD_MOSAIC_ID,
        layout: charts[0].id,
      };
    }
    return {
      type: 'mosaic' as const,
      id: DASHBOARD_MOSAIC_ID,
      layout: {
        type: 'split' as const,
        direction: 'row' as const,
        children: charts.map((c) => c.id),
      },
    };
  }, [charts]);

  // Pick the first table with columns for the chart builder
  const firstTableWithColumns = useMemo(
    () => tables.find((t) => t.columns && t.columns.length > 0),
    [tables],
  );

  const builderTableName = firstTableWithColumns?.tableName ?? '';
  const builderColumns: ChartBuilderColumn[] = useMemo(
    () =>
      firstTableWithColumns?.columns?.map((c) => ({
        name: c.name,
        type: c.type,
      })) ?? [],
    [firstTableWithColumns],
  );

  const handleCreateChart = useCallback(
    (spec: Spec, title: string) => {
      if (!currentSheetId) return;
      const chartId = `chart-${Date.now()}`;
      const newChart: DashboardChartConfig = {
        id: chartId,
        title,
        vgplot: JSON.stringify(spec, null, 2),
      };
      addChart(currentSheetId, newChart);
    },
    [currentSheetId, addChart],
  );

  if (!currentSheetId) {
    return null;
  }

  if (mosaicConnection.status === 'loading') {
    return <SpinnerPane className="h-full w-full" />;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <h3 className="text-sm font-medium">Dashboard</h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setBuilderOpen(true)}
          disabled={!builderTableName}
        >
          <Plus className="mr-1 h-4 w-4" />
          Add Chart
        </Button>
      </div>

      <div className="min-h-0 flex-1">
        {!charts || charts.length === 0 ? (
          <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 text-sm">
            <p>No charts yet. Add one to get started.</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setBuilderOpen(true)}
              disabled={!builderTableName}
            >
              <Plus className="mr-1 h-4 w-4" />
              Add Chart
            </Button>
          </div>
        ) : (
          <LayoutRenderer rootLayout={mosaicNode} />
        )}
      </div>

      {builderTableName && (
        <MosaicChartBuilder.Dialog
          open={builderOpen}
          onOpenChange={setBuilderOpen}
          tableName={builderTableName}
          columns={builderColumns}
          onCreateChart={handleCreateChart}
        />
      )}
    </div>
  );
};
