import {Param, Selection, VgPlotChart} from '@sqlrooms/mosaic';
import {RoomPanel} from '@sqlrooms/room-shell';
import {Button, cn, SpinnerPane} from '@sqlrooms/ui';
import {useEffect, useMemo, useState} from 'react';
import {
  FLIGHT_FILTER_SELECTION_NAME,
  OPENSKY_CHART_TABLE_NAME,
  createFlightsChartViewSql,
  useRoomStore,
} from '../store';
import {defaultChartConfigs, type ChartConfig} from './filterPlots';

function FlightsChart({
  chart,
  brushSelection,
  highlightSelection,
}: {
  chart: ChartConfig;
  brushSelection: Param<any>;
  highlightSelection: Selection;
}) {
  const paramsMap = useMemo(
    () =>
      new Map<string, Param<any>>([
        ['brush', brushSelection],
        ['highlight', highlightSelection as unknown as Param<any>],
      ]),
    [brushSelection, highlightSelection],
  );

  return <VgPlotChart spec={chart.spec} params={paramsMap} />;
}

export function FlightsChartsPanel({className}: {className?: string}) {
  const mosaic = useRoomStore((state) => state.mosaic);
  const mosaicConnection = useRoomStore((state) => state.mosaic.connection);
  const flightPointsTable = useRoomStore((state) =>
    state.db.findTableByName('opensky_nyc_flight_points'),
  );
  const createTableFromQuery = useRoomStore(
    (state) => state.db.createTableFromQuery,
  );
  const selection = useMemo(
    () => mosaic.getSelection(FLIGHT_FILTER_SELECTION_NAME),
    [mosaic],
  );
  const [chartViewReady, setChartViewReady] = useState(false);
  const [selectionVersion, setSelectionVersion] = useState(0);

  const chartHighlightSelections = useMemo(
    () =>
      new Map(
        defaultChartConfigs.map((chart) => [chart.id, Selection.intersect()]),
      ),
    [],
  );

  const activeFilterCount = useMemo(() => {
    void selectionVersion;
    return selection.clauses.length;
  }, [selection, selectionVersion]);

  useEffect(() => {
    const handleSelectionChange = () => {
      setSelectionVersion((version) => version + 1);
    };

    selection.addEventListener('value', handleSelectionChange);
    return () => {
      selection.removeEventListener('value', handleSelectionChange);
    };
  }, [selection]);

  useEffect(() => {
    if (
      !flightPointsTable ||
      mosaicConnection.status !== 'ready' ||
      chartViewReady
    ) {
      return;
    }

    let cancelled = false;

    void (async () => {
      await createTableFromQuery(
        OPENSKY_CHART_TABLE_NAME,
        createFlightsChartViewSql(),
        {replace: true, view: true},
      );
      if (!cancelled) {
        setChartViewReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    chartViewReady,
    createTableFromQuery,
    flightPointsTable,
    mosaicConnection.status,
  ]);

  if (mosaicConnection.status === 'loading') {
    return <SpinnerPane className="h-full w-full" />;
  }

  if (
    !flightPointsTable ||
    mosaicConnection.status !== 'ready' ||
    !chartViewReady
  ) {
    return null;
  }

  return (
    <RoomPanel type="filters" showHeader={false} className={className}>
      <section className={cn('bg-background flex h-full min-h-0 flex-col')}>
        <div className="border-b px-3 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">NYC Flight Filters</h2>
              <p className="text-muted-foreground mt-1 text-xs leading-5">
                Cross-filter flights by departure airport, arrival airport, and
                an approximate airline/operator code derived from the leading
                callsign prefix. Cesium consumes the same Mosaic selection, so
                the globe stays in sync with the charts.
              </p>
            </div>

            <Button
              variant="outline"
              size="xs"
              disabled={activeFilterCount === 0}
              onClick={() => {
                selection.reset();
                chartHighlightSelections.forEach((highlightSelection) => {
                  highlightSelection.reset();
                });
              }}
            >
              Reset All
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-2">
          <div className="space-y-3">
            {defaultChartConfigs.map((chart) => (
              <div key={chart.id} className="rounded-sm border px-2 py-2">
                <div className="pb-2 text-sm font-medium">{chart.title}</div>
                <div className="overflow-hidden">
                  <FlightsChart
                    chart={chart}
                    brushSelection={selection as Param<any>}
                    highlightSelection={chartHighlightSelections.get(chart.id)!}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t">
          <div className="text-muted-foreground px-3 py-2 text-[11px] leading-4">
            Airline code is approximate: commercial callsigns often expose a
            three-letter operator prefix like <code>UAL</code> or{' '}
            <code>DAL</code>, while private/general aviation flights fall into{' '}
            <code>Unknown</code>.
          </div>
        </div>
      </section>
    </RoomPanel>
  );
}
