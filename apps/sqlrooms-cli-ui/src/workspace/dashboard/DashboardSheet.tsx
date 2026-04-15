import {useCellsStore} from '@sqlrooms/cells';
import {LayoutRenderer} from '@sqlrooms/layout';
import type {LayoutMosaicNode} from '@sqlrooms/layout';
import type {ChartBuilderColumn, Spec} from '@sqlrooms/mosaic';
import {MosaicChartBuilder, MosaicProfiler} from '@sqlrooms/mosaic';
import {
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ScrollArea,
  SpinnerPane,
} from '@sqlrooms/ui';
import {Check, ChevronsUpDown, Plus} from 'lucide-react';
import {useCallback, useEffect, useMemo, useState} from 'react';
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

  const tablesWithColumns = useMemo(
    () => tables.filter((t) => t.columns && t.columns.length > 0),
    [tables],
  );

  const [selectedTable, setSelectedTable] = useState('');
  const [tablePickerOpen, setTablePickerOpen] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);

  // Auto-select first table when available
  useEffect(() => {
    if (!selectedTable && tablesWithColumns.length > 0) {
      setSelectedTable(tablesWithColumns[0].tableName);
    }
  }, [selectedTable, tablesWithColumns]);

  const selectedTableInfo = useMemo(
    () => tablesWithColumns.find((t) => t.tableName === selectedTable),
    [tablesWithColumns, selectedTable],
  );

  const builderColumns: ChartBuilderColumn[] = useMemo(
    () =>
      selectedTableInfo?.columns?.map((c) => ({
        name: c.name,
        type: c.type,
      })) ?? [],
    [selectedTableInfo],
  );

  useEffect(() => {
    if (!currentSheetId) return;
    ensureSheetDashboard(currentSheetId);
  }, [currentSheetId, ensureSheetDashboard]);

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
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium">Dashboard</h3>
          <Popover open={tablePickerOpen} onOpenChange={setTablePickerOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                role="combobox"
                aria-expanded={tablePickerOpen}
                className="w-[200px] justify-between"
              >
                <span className="truncate">
                  {selectedTable || 'Select table…'}
                </span>
                <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[220px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search tables…" />
                <CommandList>
                  <CommandEmpty>No tables found.</CommandEmpty>
                  <CommandGroup>
                    {tablesWithColumns.map((t) => (
                      <CommandItem
                        key={t.tableName}
                        value={t.tableName}
                        onSelect={(val) => {
                          setSelectedTable(val === selectedTable ? '' : val);
                          setTablePickerOpen(false);
                        }}
                      >
                        <Check
                          className={`mr-2 h-3.5 w-3.5 ${selectedTable === t.tableName ? 'opacity-100' : 'opacity-0'}`}
                        />
                        {t.tableName}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setBuilderOpen(true)}
          disabled={!selectedTable}
        >
          <Plus className="mr-1 h-4 w-4" />
          Add Chart
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {selectedTable && mosaicConnection.status === 'ready' && (
          <MosaicProfiler tableName={selectedTable} pageSize={10}>
            <div className="border-b">
              <div className="min-h-0 overflow-auto">
                <MosaicProfiler.Table>
                  <MosaicProfiler.Header />
                  <MosaicProfiler.Rows />
                </MosaicProfiler.Table>
              </div>
              <MosaicProfiler.StatusBar />
            </div>
          </MosaicProfiler>
        )}

        <div className="min-h-0 flex-1">
          {!charts || charts.length === 0 ? (
            <div className="text-muted-foreground flex h-64 flex-col items-center justify-center gap-2 text-sm">
              <p>No charts yet. Add one to get started.</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setBuilderOpen(true)}
                disabled={!selectedTable}
              >
                <Plus className="mr-1 h-4 w-4" />
                Add Chart
              </Button>
            </div>
          ) : (
            <LayoutRenderer rootLayout={mosaicNode} />
          )}
        </div>
      </ScrollArea>

      {selectedTable && (
        <MosaicChartBuilder.Dialog
          open={builderOpen}
          onOpenChange={setBuilderOpen}
          tableName={selectedTable}
          columns={builderColumns}
          onCreateChart={handleCreateChart}
        />
      )}
    </div>
  );
};
