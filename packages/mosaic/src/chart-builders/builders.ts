import {
  AlignHorizontalDistributeCenter,
  BarChart3,
  BarChartHorizontal,
  Workflow as BubblesIcon,
  ChartNoAxesCombined,
  Code,
  Grid3X3,
  LineChart,
  TrendingUp,
} from 'lucide-react';
import type {ComponentType} from 'react';
import type {ChartBuilderTemplate, ChartTypeDefinition} from './types';
import {
  boxPlotChartType,
  bubbleChartChartType,
  countPlotChartType,
  createDefaultChartTypes,
  customSpecChartType,
  ecdfChartType,
  heatmapChartType,
  histogramChartType,
  lineChartChartType,
  mosaicChartTypes,
} from './chartTypes';

const defaultChartTypeIcons: Record<
  string,
  ComponentType<{className?: string}>
> = {
  'count-plot': BarChartHorizontal,
  histogram: BarChart3,
  'line-chart': LineChart,
  ecdf: TrendingUp,
  heatmap: Grid3X3,
  'box-plot': AlignHorizontalDistributeCenter,
  'bubble-chart': BubblesIcon,
  'custom-spec': Code,
};

export function createChartBuilderTemplate(
  chartType: ChartTypeDefinition,
  icon: ComponentType<{className?: string}> = ChartNoAxesCombined,
): ChartBuilderTemplate {
  return {
    ...chartType,
    icon,
  };
}

export function createChartBuilderTemplates(
  chartTypes: ChartTypeDefinition[],
): ChartBuilderTemplate[] {
  return chartTypes.map((chartType) =>
    createChartBuilderTemplate(
      chartType,
      defaultChartTypeIcons[chartType.id] ?? ChartNoAxesCombined,
    ),
  );
}

export const countPlotBuilder = createChartBuilderTemplate(
  countPlotChartType,
  BarChartHorizontal,
);
export const histogramBuilder = createChartBuilderTemplate(
  histogramChartType,
  BarChart3,
);
export const lineChartBuilder = createChartBuilderTemplate(
  lineChartChartType,
  LineChart,
);
export const ecdfBuilder = createChartBuilderTemplate(
  ecdfChartType,
  TrendingUp,
);
export const heatmapBuilder = createChartBuilderTemplate(
  heatmapChartType,
  Grid3X3,
);
export const boxPlotBuilder = createChartBuilderTemplate(
  boxPlotChartType,
  AlignHorizontalDistributeCenter,
);
export const bubbleChartBuilder = createChartBuilderTemplate(
  bubbleChartChartType,
  BubblesIcon,
);
export const customSpecBuilder = createChartBuilderTemplate(
  customSpecChartType,
  Code,
);

/**
 * Creates the default set of chart builders.
 * Call this to get a fresh array that you can extend or filter.
 */
export function createDefaultChartBuilders(): ChartBuilderTemplate[] {
  return createChartBuilderTemplates(createDefaultChartTypes());
}

/**
 * Named built-in chart templates for cherry-picking and
 * {@link MosaicChartBuilder.chartBuilders}.
 */
export const mosaicChartBuilders = {
  countPlot: countPlotBuilder,
  histogram: histogramBuilder,
  lineChart: lineChartBuilder,
  ecdf: ecdfBuilder,
  heatmap: heatmapBuilder,
  boxPlot: boxPlotBuilder,
  bubbleChart: bubbleChartBuilder,
  customSpec: customSpecBuilder,
} as const;
