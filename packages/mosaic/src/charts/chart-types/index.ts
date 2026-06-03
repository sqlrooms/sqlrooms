// Re-export base types
export * from './base-types';

// Re-export error classes for chart definitions
export * from './errors';

// CRITICAL: Export ChartConfig FIRST, before importing Settings components
// Export ChartConfig from separate file to avoid circular dependencies
// (chart-types/index imports Settings components, which import ChartSettingsContext,
// which imports ChartConfig)
export {ChartConfig, type ChartSettings, type ChartType} from './chart-config';
export * from './data-policy-schema';

// Re-export schemas
export * from './histogram/schema';
export * from './line-chart/schema';
export * from './count-plot/schema';
export * from './heatmap/schema';
export * from './box-plot/schema';
export * from './bubble-chart/schema';
export * from './custom-spec/schema';

// Re-export Settings components
export {HistogramSettingsComponent} from './histogram/HistogramSettings';
export {LineChartSettingsComponent} from './line-chart/LineChartSettings';
export {CountPlotSettingsComponent} from './count-plot/CountPlotSettings';
export {HeatmapSettingsComponent} from './heatmap/HeatmapSettings';
export {BoxPlotSettingsComponent} from './box-plot/BoxPlotSettings';
export {BubbleChartSettingsComponent} from './bubble-chart/BubbleChartSettings';
export {CustomSpecSettingsComponent} from './custom-spec/CustomSpecSettings';

// Re-export definitions
export * from './histogram/definition';
export * from './line-chart/definition';
export * from './count-plot/definition';
export * from './heatmap/definition';
export * from './box-plot/definition';
export * from './bubble-chart/definition';
export * from './custom-spec/definition';

// Re-export tool types, schemas, validation, helpers, and AI tool creators
export * from '../../ai/tool-types';
export * from '../../ai/tool-schemas';
export * from '../../ai/tool-validation';
export * from '../../ai/tool-helpers';
export * from './histogram/tool';
export * from './line-chart/tool';
export * from './count-plot/tool';
export * from './heatmap/tool';
export * from './bubble-chart/tool';
export * from './box-plot/tool';
export * from '../../ai/data-table-explorer-tool';
export * from '../../ai/list-panels-tool';
export * from '../../ai/remove-panel-tool';

// Re-export chart type utilities
export {mosaicChartTypes} from './mosaicChartTypes';
export {createDefaultChartTypes} from './createDefaultChartTypes';
export {createChartTools} from './createChartTools';
