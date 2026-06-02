import type {BoxPlotOutlierRow, BoxPlotSummaryRow} from './BoxPlotClient';
import type {PlotSize} from '../../../ResponsivePlot';
import {MARGINS} from './constants';

export function formatCategory(value: unknown): string {
  return value === null || value === undefined ? '(null)' : String(value);
}

export function getYDomain(
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

export function yPixelToValue(
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
