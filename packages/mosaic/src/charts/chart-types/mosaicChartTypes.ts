import {histogramChartType} from './histogram/definition';
import {lineChartChartType} from './line-chart/definition';
import {countPlotChartType} from './count-plot/definition';
import {heatmapChartType} from './heatmap/definition';
import {boxPlotChartType} from './box-plot/definition';
import {scatterPlotChartType} from './scatter-plot-chart/definition';
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
  scatterPlot: scatterPlotChartType,
  customSpec: customSpecChartType,
} as const;
