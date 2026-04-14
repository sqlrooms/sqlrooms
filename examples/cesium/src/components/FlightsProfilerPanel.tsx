import {type Param, VgPlotChart} from '@sqlrooms/mosaic';
import {RoomPanel} from '@sqlrooms/room-shell';
import {Button, cn, SpinnerPane} from '@sqlrooms/ui';
import {useEffect, useMemo, useRef, useState} from 'react';
import {
  FLIGHT_FILTER_SELECTION_NAME,
  OPENSKY_CHART_TABLE_NAME,
  createFlightsChartViewSql,
  useRoomStore,
} from '../store';
import {defaultChartConfigs} from './filterPlots';

function getSelectionFieldName(field: unknown) {
  if (typeof field === 'string') {
    return field;
  }

  if (field && typeof field === 'object') {
    const candidate = field as {
      basis?: unknown;
      column?: unknown;
      name?: unknown;
    };

    if (typeof candidate.basis === 'string') {
      return candidate.basis;
    }
    if (typeof candidate.column === 'string') {
      return candidate.column;
    }
    if (typeof candidate.name === 'string') {
      return candidate.name;
    }
  }

  return null;
}

function getSelectedValuesForField(selection: any, fieldName: string) {
  const selectedValues = new Set<string>();

  for (const clause of selection?.clauses ?? []) {
    const sourceFields = Array.isArray(clause?.source?.fields)
      ? clause.source.fields
      : [];
    const sourceFieldName = getSelectionFieldName(sourceFields[0]);

    if (sourceFieldName !== fieldName || !Array.isArray(clause?.value)) {
      continue;
    }

    for (const point of clause.value) {
      if (Array.isArray(point) && point.length > 0 && point[0] != null) {
        selectedValues.add(String(point[0]));
      }
    }
  }

  return selectedValues;
}

function parseTranslateY(element: Element) {
  const transform = element.getAttribute('transform');
  if (!transform) {
    return null;
  }

  const match = /translate\([^,]+,\s*([^)]+)\)/.exec(transform);
  if (!match) {
    return null;
  }

  const parsed = Number.parseFloat(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function highlightSelectedBars(
  container: HTMLElement,
  fieldName: string,
  selection: any,
) {
  const svg = container.querySelector('svg');
  if (!svg) {
    return;
  }

  const selectedValues = getSelectedValuesForField(selection, fieldName);
  const labelNodes = Array.from(
    svg.querySelectorAll<SVGTextElement>(
      'g[aria-label="y-axis tick label"] text',
    ),
  );
  const selectedPositions = new Set<number>();

  for (const labelNode of labelNodes) {
    const isSelected = selectedValues.has(labelNode.textContent?.trim() ?? '');
    const y = parseTranslateY(labelNode);

    if (isSelected && y != null) {
      selectedPositions.add(y);
    }

    labelNode.style.fontWeight = isSelected ? '700' : '';
    labelNode.style.fill = isSelected ? '#fff7ed' : '';
  }

  const barNodes = Array.from(
    svg.querySelectorAll<SVGElement>('g[aria-label="bar"] rect'),
  );

  for (const barNode of barNodes) {
    const barY = Number.parseFloat(barNode.getAttribute('y') ?? '');
    const isSelected = Number.isFinite(barY)
      ? Array.from(selectedPositions).some(
          (selectedY) => Math.abs(selectedY - barY) < 1,
        )
      : false;

    barNode.style.stroke = isSelected ? '#fff7ed' : '';
    barNode.style.strokeWidth = isSelected ? '2' : '';
    barNode.style.paintOrder = isSelected ? 'stroke fill' : '';
  }
}

function FlightsChart({
  chart,
  paramsMap,
  selection,
}: {
  chart: (typeof defaultChartConfigs)[number];
  paramsMap: Map<string, Param<any>>;
  selection: any;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectionVersion, setSelectionVersion] = useState(0);

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
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const applyHighlight = () => {
      highlightSelectedBars(container, chart.selectionField, selection);
    };

    applyHighlight();

    const observer = new MutationObserver(() => {
      applyHighlight();
    });

    observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['transform', 'y'],
    });

    return () => {
      observer.disconnect();
    };
  }, [chart.selectionField, selection, selectionVersion]);

  return (
    <div ref={containerRef} className="overflow-hidden">
      <VgPlotChart spec={chart.spec} params={paramsMap} />
    </div>
  );
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
  const paramsMap = useMemo(
    () => new Map<string, Param<any>>([['brush', selection as Param<any>]]),
    [selection],
  );
  const [chartViewReady, setChartViewReady] = useState(false);
  const [selectionVersion, setSelectionVersion] = useState(0);
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
              onClick={() => selection.reset()}
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
                <FlightsChart
                  chart={chart}
                  paramsMap={paramsMap}
                  selection={selection}
                />
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
