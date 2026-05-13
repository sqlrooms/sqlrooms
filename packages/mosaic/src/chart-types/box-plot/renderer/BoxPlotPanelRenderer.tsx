import type {FC, PointerEvent as ReactPointerEvent} from 'react';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {SpinnerPane} from '@sqlrooms/ui';
import {type PlotSize, ResponsivePlot} from '../../../ResponsivePlot';
import type {ChartRendererProps} from '../../base-types';
import {
  MARGINS,
  type PlotOutlierDatum,
  type PlotSummaryDatum,
} from './constants';
import {createBoxPlotElement} from './plot';
import type {BoxPlotChartConfig} from '../schema';
import {useBoxPlotClient} from './useBoxPlotClient';
import {formatCategory, getYDomain, yPixelToValue} from './utils';

/**
 * Custom renderer for box-plot chart type.
 * Uses BoxPlotClient for SQL-based quartile calculations and custom Observable Plot rendering.
 */
export const BoxPlotPanelRenderer: FC<
  ChartRendererProps<BoxPlotChartConfig>
> = ({tableName, config, coordinator}) => {
  const configX = config.settings.x;
  const configY = config.settings.y;
  const boxPlotConfig = useMemo(
    () =>
      typeof configX === 'string' && typeof configY === 'string'
        ? {x: configX, y: configY}
        : null,
    [configX, configY],
  );

  const [size, setSize] = useState<PlotSize | null>(null);
  const [drag, setDrag] = useState<{startY: number; currentY: number} | null>(
    null,
  );
  const plotRef = useRef<HTMLDivElement>(null);

  const {clientRef, state} = useBoxPlotClient({
    config: boxPlotConfig,
    coordinator,
    tableName,
  });

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
    if (!container || !size || !boxPlotConfig) {
      return;
    }
    if (!summaries.length) {
      container.replaceChildren();
      return;
    }

    const plot = createBoxPlotElement({
      config: boxPlotConfig,
      domain: yDomain,
      outliers,
      size,
      summaries,
    });
    container.replaceChildren(plot);
  }, [boxPlotConfig, outliers, size, summaries, yDomain]);

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

  if (!config.settings.x || !config.settings.y) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <div className="text-center font-medium">
          Configure chart to display visualization
        </div>
        <div className="text-center text-xs">
          X and Y fields are required for box plot
        </div>
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
};
