import {histogramChartType} from './histogram/definition';
import {lineChartChartType} from './line-chart/definition';
import {countPlotChartType} from './count-plot/definition';
import {heatmapChartType} from './heatmap/definition';
import {boxPlotChartType} from './box-plot/definition';
import {bubbleChartChartType} from './bubble-chart/definition';
import {customSpecChartType} from './custom-spec/definition';

/**
 * Legacy compatibility exports for all available chart types.
 */
export const mosaicChartTypes = {
  histogram: histogramChartType,
  countPlot: countPlotChartType,
  lineChart: lineChartChartType,
  heatmap: heatmapChartType,
  boxPlot: boxPlotChartType,
  bubbleChart: bubbleChartChartType,
  customSpec: customSpecChartType,
} as const;
