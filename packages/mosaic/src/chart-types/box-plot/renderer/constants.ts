import type {
  BoxPlotOutlierRow,
  BoxPlotSummaryRow,
} from '../../../boxplot/BoxPlotClient';

export const BOX_FILL = 'var(--color-chart-1)';
export const BOX_STROKE = 'var(--color-chart-1)';
export const GRID_COLOR = 'var(--border)';
export const OUTLIER_FILL = 'var(--color-chart-2)';
export const MAX_BOX_ITEM_WIDTH = 20;

export const MARGINS = {
  bottom: 64,
  left: 56,
  right: 24,
  top: 20,
} as const;

export type PlotSummaryDatum = BoxPlotSummaryRow & {
  categoryLabel: string;
};

export type PlotOutlierDatum = BoxPlotOutlierRow & {
  categoryLabel: string;
};
