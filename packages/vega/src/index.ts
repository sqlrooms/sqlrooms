/**
 * {@include ../README.md}
 * @packageDocumentation
 */

import {VegaLiteSqlChart} from './VegaLiteSqlChart';
import {VegaLiteArrowChart} from './VegaLiteArrowChart';

export {VegaChartToolResult as VegaChartToolResult} from './VegaChartToolResult';
export type {VisualizationSpec} from 'vega-embed';
export {
  createVegaChartTool,
  VegaChartToolParameters,
  DEFAULT_VEGA_CHART_DESCRIPTION,
} from './VegaChartTool';
export type {VegaChartToolParameters as VegaChartToolParametersType} from './VegaChartTool';

export const VegaLiteChart = Object.assign(VegaLiteSqlChart, {
  SqlChart: VegaLiteSqlChart,
  ArrowChart: VegaLiteArrowChart,
});
