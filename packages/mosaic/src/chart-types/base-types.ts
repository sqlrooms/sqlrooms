/**
 * Base types for chart configurations.
 * Separated to avoid circular dependencies.
 */

/**
 * Supported chart type identifiers
 */
export type VgPlotChartType =
  | 'histogram'
  | 'count-plot'
  | 'ecdf'
  | 'line-chart'
  | 'bubble-chart'
  | 'heatmap'
  | 'custom-spec';
