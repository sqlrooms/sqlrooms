import {SpinnerPane} from '@sqlrooms/ui';
import type {Selection} from '@uwdata/mosaic-core';
import * as Plot from '@observablehq/plot';
import {AlignHorizontalDistributeCenter} from 'lucide-react';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {PointerEvent as ReactPointerEvent} from 'react';
import {
  BoxPlotClient,
  type BoxPlotOutlierRow,
  type BoxPlotState,
  type BoxPlotSummaryRow,
} from '../boxplot/BoxPlotClient';
import {type PlotSize, ResponsivePlot} from '../ResponsivePlot';
import {
  type BoxPlotPanelConfig,
  type BoxPlotPanelRendererProps,
  type MosaicDashboardPanelRenderer,
  useStoreWithMosaicDashboard,
} from './MosaicDashboardSlice';

const BOX_FILL = 'var(--color-chart-1)';
const BOX_STROKE = 'var(--color-chart-1)';
const GRID_COLOR = 'var(--border)';
const OUTLIER_FILL = 'var(--color-chart-2)';

const MARGINS = {
  bottom: 64,
  left: 56,
  right: 24,
  top: 20,
};

type PlotSummaryDatum = BoxPlotSummaryRow & {
  categoryLabel: string;
};

type PlotOutlierDatum = BoxPlotOutlierRow & {
  categoryLabel: string;
};

function formatCategory(value: unknown): string {
  return value === null || value === undefined ? '(null)' : String(value);
}

function getYDomain(
  summaries: BoxPlotSummaryRow[],
  outliers: BoxPlotOutlierRow[],
): [number, number] {
  const values = [
    ...summaries.flatMap((row) => [
      row.whiskerLow,
      row.whiskerHigh,
      row.q1,
      row.q3,
      row.median,
    ]),
    ...outliers.map((row) => row.value),
  ].filter((value) => Number.isFinite(value));

  if (!values.length) {
    return [0, 1];
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    const pad = Math.abs(min) || 1;
    return [min - pad * 0.5, max + pad * 0.5];
  }

  const pad = (max - min) * 0.08;
  return [min - pad, max + pad];
}

function yPixelToValue(
  pixelY: number,
  size: PlotSize,
  domain: [number, number],
) {
  const plotHeight = Math.max(1, size.height - MARGINS.top - MARGINS.bottom);
  const clampedY = Math.min(
    size.height - MARGINS.bottom,
    Math.max(MARGINS.top, pixelY),
  );
  const ratio = (clampedY - MARGINS.top) / plotHeight;
  return domain[1] - ratio * (domain[1] - domain[0]);
}

function createBoxPlotElement(args: {
  config: {x: string; y: string};
  domain: [number, number];
  outliers: PlotOutlierDatum[];
  size: PlotSize;
  summaries: PlotSummaryDatum[];
}) {
  const {config, domain, outliers, size, summaries} = args;
  const categories = summaries.map((row) => row.categoryLabel);

  return Plot.plot({
    height: size.height,
    marginBottom: MARGINS.bottom,
    marginLeft: MARGINS.left,
    marginRight: MARGINS.right,
    marginTop: MARGINS.top,
    style: {
      background: 'transparent',
      color: 'currentColor',
      font: '12px var(--font-sans, system-ui, sans-serif)',
      overflow: 'visible',
    },
    width: size.width,
    x: {
      domain: categories,
      label: config.x,
      tickRotate: categories.length > 8 ? -35 : 0,
    },
    y: {
      domain,
      grid: true,
      label: config.y,
      nice: true,
    },
    marks: [
      Plot.gridY({stroke: GRID_COLOR, strokeOpacity: 0.65}),
      Plot.ruleX(summaries, {
        x: 'categoryLabel',
        y1: 'whiskerLow',
        y2: 'whiskerHigh',
        stroke: BOX_STROKE,
        strokeWidth: 1.2,
      }),
      Plot.tickY(summaries, {
        x: 'categoryLabel',
        y: 'whiskerLow',
        stroke: BOX_STROKE,
        strokeWidth: 1.4,
      }),
      Plot.tickY(summaries, {
        x: 'categoryLabel',
        y: 'whiskerHigh',
        stroke: BOX_STROKE,
        strokeWidth: 1.4,
      }),
      Plot.rectY(summaries, {
        fill: BOX_FILL,
        fillOpacity: 0.22,
        insetLeft: 8,
        insetRight: 8,
        stroke: BOX_STROKE,
        strokeWidth: 1.2,
        x: 'categoryLabel',
        y1: 'q1',
        y2: 'q3',
      }),
      Plot.tickY(summaries, {
        x: 'categoryLabel',
        y: 'median',
        stroke: BOX_STROKE,
        strokeWidth: 2.4,
      }),
      Plot.dot(outliers, {
        fill: OUTLIER_FILL,
        fillOpacity: 0.7,
        r: 2.5,
        stroke: 'transparent',
        x: 'categoryLabel',
        y: 'value',
      }),
    ],
  });
}

function useBoxPlotClient(args: {
  config: {x: string; y: string} | null;
  selection?: Selection;
  tableName?: string;
}) {
  const {config, selection, tableName} = args;
  const connection = useStoreWithMosaicDashboard(
    (state) => state.mosaic.connection,
  );
  const [state, setState] = useState<BoxPlotState>({
    isLoading: true,
    outliers: [],
    summaries: [],
  });
  const clientRef = useRef<BoxPlotClient | null>(null);

  useEffect(() => {
    if (connection.status !== 'ready' || !selection || !tableName || !config) {
      clientRef.current = null;
      return;
    }

    const client = new BoxPlotClient({
      onStateChange: setState,
      selection,
      tableName,
      x: config.x,
      y: config.y,
    });
    clientRef.current = client;
    connection.coordinator.connect(client);

    return () => {
      client.destroy();
      if (clientRef.current === client) {
        clientRef.current = null;
      }
    };
  }, [config, connection, selection, tableName]);

  return {clientRef, state};
}

function MosaicDashboardBoxPlotRenderer({
  panel,
  resolvedSource,
  selectionName,
}: BoxPlotPanelRendererProps) {
  const configX = panel.config.x;
  const configY = panel.config.y;
  const config = useMemo(
    () =>
      typeof configX === 'string' && typeof configY === 'string'
        ? {x: configX, y: configY}
        : null,
    [configX, configY],
  );
  const getSelection = useStoreWithMosaicDashboard(
    (state) => state.mosaic.getSelection,
  );
  const selection = useStoreWithMosaicDashboard(
    (state) => state.mosaic.selections[selectionName],
  );
  const [size, setSize] = useState<PlotSize | null>(null);
  const [drag, setDrag] = useState<{startY: number; currentY: number} | null>(
    null,
  );
  const plotRef = useRef<HTMLDivElement>(null);
  const tableName = resolvedSource?.tableName;
  const {clientRef, state} = useBoxPlotClient({
    config,
    selection,
    tableName,
  });

  useEffect(() => {
    if (!selection) {
      getSelection(selectionName, 'crossfilter');
    }
  }, [getSelection, selection, selectionName]);

  const summaries = useMemo<PlotSummaryDatum[]>(
    () =>
      state.summaries.map((row) => ({
        ...row,
        categoryLabel: formatCategory(row.category),
      })),
    [state.summaries],
  );
  const outliers = useMemo<PlotOutlierDatum[]>(
    () =>
      state.outliers.map((row) => ({
        ...row,
        categoryLabel: formatCategory(row.category),
      })),
    [state.outliers],
  );
  const yDomain = useMemo(
    () => getYDomain(state.summaries, state.outliers),
    [state.outliers, state.summaries],
  );

  useEffect(() => {
    const container = plotRef.current;
    if (!container || !size || !config) {
      return;
    }
    if (!summaries.length) {
      container.replaceChildren();
      return;
    }

    const plot = createBoxPlotElement({
      config,
      domain: yDomain,
      outliers,
      size,
      summaries,
    });
    container.replaceChildren(plot);
  }, [config, outliers, size, summaries, yDomain]);

  const getLocalY = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return event.clientY - rect.top;
  }, []);

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!size || !summaries.length) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      const y = getLocalY(event);
      setDrag({currentY: y, startY: y});
    },
    [getLocalY, size, summaries.length],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!drag) return;
      setDrag({...drag, currentY: getLocalY(event)});
    },
    [drag, getLocalY],
  );

  const finishDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!drag || !size) return;
      event.currentTarget.releasePointerCapture(event.pointerId);
      const currentY = getLocalY(event);
      const pixelDistance = Math.abs(currentY - drag.startY);
      setDrag(null);
      if (pixelDistance < 4) {
        clientRef.current?.updateYBrush();
        return;
      }
      clientRef.current?.updateYBrush([
        yPixelToValue(drag.startY, size, yDomain),
        yPixelToValue(currentY, size, yDomain),
      ]);
    },
    [clientRef, drag, getLocalY, size, yDomain],
  );

  const brushStyle = useMemo(() => {
    const extent = drag
      ? [drag.startY, drag.currentY]
      : state.yBrush && size
        ? state.yBrush.map((value) => {
            const plotHeight = Math.max(
              1,
              size.height - MARGINS.top - MARGINS.bottom,
            );
            return (
              MARGINS.top +
              ((yDomain[1] - value) / (yDomain[1] - yDomain[0])) * plotHeight
            );
          })
        : null;
    if (!extent) return undefined;
    const top = Math.max(MARGINS.top, Math.min(...extent));
    const bottom = Math.min(
      size?.height ? size.height - MARGINS.bottom : Number.POSITIVE_INFINITY,
      Math.max(...extent),
    );
    return {
      height: `${Math.max(0, bottom - top)}px`,
      left: `${MARGINS.left}px`,
      right: `${MARGINS.right}px`,
      top: `${top}px`,
    };
  }, [drag, size, state.yBrush, yDomain]);

  if (!config) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
        Invalid box plot config
      </div>
    );
  }

  if (!tableName) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
        Box plot requires a table source
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-auto p-2">
      <div className="bg-background text-foreground relative flex h-full min-h-[220px] w-full items-center justify-center rounded-md p-2">
        {state.error ? (
          <div className="text-destructive flex h-full items-center justify-center p-4 text-sm">
            {state.error.message}
          </div>
        ) : state.isLoading && !state.summaries.length ? (
          <SpinnerPane className="h-full w-full" />
        ) : !state.summaries.length ? (
          <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
            No numeric values for this box plot
          </div>
        ) : (
          <ResponsivePlot
            onResize={setSize}
            className="relative h-full min-h-[220px] w-full"
          >
            <div ref={plotRef} className="absolute inset-0" />
            {brushStyle ? (
              <div
                className="bg-primary/15 border-primary/60 pointer-events-none absolute border"
                style={brushStyle}
              />
            ) : null}
            <div
              className="absolute inset-0 cursor-crosshair touch-none"
              onPointerCancel={finishDrag}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={finishDrag}
            />
          </ResponsivePlot>
        )}
      </div>
    </div>
  );
}

export const mosaicDashboardBoxPlotPanelRenderer: MosaicDashboardPanelRenderer<BoxPlotPanelConfig> =
  {
    component: MosaicDashboardBoxPlotRenderer,
    icon: AlignHorizontalDistributeCenter,
  };
