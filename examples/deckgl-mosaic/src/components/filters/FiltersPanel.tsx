import type {Param} from '@sqlrooms/mosaic';
import {
  ChartBuilderColumn,
  ChartBuilderDialog,
  MosaicChartContainer,
  MosaicChartDisplay,
  MosaicChartEditorActions,
  MosaicSpecEditorPanel,
  Spec,
} from '@sqlrooms/mosaic';
import {RoomPanel} from '@sqlrooms/room-shell';
import {Button, ScrollArea, SpinnerPane} from '@sqlrooms/ui';
import {Code, Plus, X} from 'lucide-react';
import {useCallback, useMemo, useState} from 'react';
import {useRoomStore} from '../../store';
import {ChartConfig, defaultChartConfigs} from './filterPlots';

export default function FiltersPanel({className}: {className?: string}) {
  const mosaicConn = useRoomStore((state) => state.mosaic.connection);
  const isTableReady = useRoomStore((state) =>
    state.db.tables.find((t) => t.tableName === 'earthquakes'),
  );
  if (mosaicConn.status === 'loading') {
    return <SpinnerPane className="h-full w-full" />;
  }
  if (!isTableReady || mosaicConn.status !== 'ready') {
    return null;
  }
  return <FiltersPanelContent className={className} />;
}

const FiltersPanelContent = ({className}: {className?: string}) => {
  const brush = useRoomStore((state) => state.mosaic.getSelection('brush'));
  const tables = useRoomStore((state) => state.db.tables);

  // Shared params map for cross-filtering across all charts
  const paramsMap = useMemo(
    () => new Map<string, Param<any>>([['brush', brush as Param<any>]]),
    [brush],
  );

  // Chart list state
  const [charts, setCharts] = useState<ChartConfig[]>(() => [
    ...defaultChartConfigs,
  ]);

  // Track which charts have editor open
  const [editingCharts, setEditingCharts] = useState<Set<string>>(
    () => new Set(),
  );

  // Chart builder dialog state
  const [builderOpen, setBuilderOpen] = useState(false);

  // Get columns for the earthquakes table
  const columns: ChartBuilderColumn[] = useMemo(() => {
    const table = tables.find((t) => t.tableName === 'earthquakes');
    if (!table?.columns) return [];
    return table.columns.map((c) => ({name: c.name, type: c.type}));
  }, [tables]);

  const handleSpecChange = useCallback((chartId: string, newSpec: Spec) => {
    setCharts((prev) =>
      prev.map((c) => (c.id === chartId ? {...c, spec: newSpec} : c)),
    );
  }, []);

  const toggleEditor = useCallback((chartId: string) => {
    setEditingCharts((prev) => {
      const next = new Set(prev);
      if (next.has(chartId)) {
        next.delete(chartId);
      } else {
        next.add(chartId);
      }
      return next;
    });
  }, []);

  const handleCreateChart = useCallback((spec: Spec, title: string) => {
    const id = `chart-${Date.now()}`;
    setCharts((prev) => [{id, title, spec}, ...prev]);
    setExpandedCharts((prev) => [id, ...prev]);
  }, []);

  const handleRemoveChart = useCallback((chartId: string) => {
    setCharts((prev) => prev.filter((c) => c.id !== chartId));
    setExpandedCharts((prev) => prev.filter((id) => id !== chartId));
    setEditingCharts((prev) => {
      const next = new Set(prev);
      next.delete(chartId);
      return next;
    });
  }, []);

  const [expandedCharts, setExpandedCharts] = useState<string[]>(() =>
    charts.map((c) => c.id),
  );

  return (
    <RoomPanel type="filters" showHeader={false} className={className}>
      <div className="flex h-full flex-col">
        <div className="p-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setBuilderOpen(true)}
          >
            <Plus className="mr-1 h-4 w-4" />
            Add Chart
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2">
            <div
              type="multiple"
              value={expandedCharts}
              onValueChange={setExpandedCharts}
              className="w-full space-y-2"
            >
              {charts.map((chart) => {
                const isEditing = editingCharts.has(chart.id);
                return (
                  <div
                    key={chart.id}
                    value={chart.id}
                    className="rounded-sm border px-2"
                  >
                    <div className="py-2 hover:no-underline">
                      <div className="flex w-full items-center justify-between pr-2">
                        <span className="text-sm font-medium">
                          {chart.title}
                        </span>
                        <div
                          className="flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => toggleEditor(chart.id)}
                            title={isEditing ? 'Hide editor' : 'Edit spec'}
                          >
                            <Code className="h-3.5 w-3.5" />
                          </Button>
                          {!defaultChartConfigs.some(
                            (d) => d.id === chart.id,
                          ) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleRemoveChart(chart.id)}
                              title="Remove chart"
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="overflow-hidden pb-4">
                      <MosaicChartContainer
                        spec={chart.spec}
                        params={paramsMap}
                        editable={isEditing}
                        onSpecChange={(spec) =>
                          handleSpecChange(chart.id, spec)
                        }
                      >
                        <MosaicChartDisplay />
                        {isEditing && (
                          <>
                            <MosaicSpecEditorPanel
                              className="h-64 border-t"
                              title=""
                            />
                            <MosaicChartEditorActions />
                          </>
                        )}
                      </MosaicChartContainer>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </ScrollArea>

        <ChartBuilderDialog
          open={builderOpen}
          onOpenChange={setBuilderOpen}
          tableName="earthquakes"
          columns={columns}
          onCreateChart={handleCreateChart}
        />
      </div>
    </RoomPanel>
  );
};
