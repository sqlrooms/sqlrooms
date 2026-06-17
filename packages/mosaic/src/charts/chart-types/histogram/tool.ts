import {tool} from 'ai';
import {z} from 'zod';
import {
  HistogramChartConfig,
  HistogramChartSettings,
  MIN_BINS_COUNT,
  MAX_BINS_COUNT,
  DEFAULT_BINS_COUNT,
} from './schema';
import {BaseChartToolParameters} from '../../../ai/tool-schemas';
import {QUANTITATIVE_COLUMN_TYPES} from '../../../column-types-utils';
import {ChartToolDeps, ChartToolOutput} from '../tool-types';
import {validateHistogramSettings} from './validation';

export const HistogramToolParameters = BaseChartToolParameters.extend({
  settings: HistogramChartSettings.required(),
});

export type HistogramToolParams = z.infer<typeof HistogramToolParameters>;

export function createHistogramAiTool(deps: ChartToolDeps) {
  return tool<HistogramToolParams, ChartToolOutput<HistogramChartConfig>>({
    description: `Histogram: shows distribution of numeric values by automatically grouping data into bins/ranges.

Use when: user asks about "distribution of [numeric column]", "spread of", "range of", "how values are distributed", "show histogram".
Example queries: "distribution of population density", "show elevation distribution", "histogram of parcel areas", "how are building heights spread", "temperature range distribution".

Required: field must be quantitative not text/categorical: (${QUANTITATIVE_COLUMN_TYPES.join(', ')}).

NOTE: Histograms automatically bin data into ranges and aggregate counts, so they handle large datasets efficiently (no data point limit).

Optional: maxBins (${MIN_BINS_COUNT}-${MAX_BINS_COUNT}, default ${DEFAULT_BINS_COUNT}) controls the number of bins/bars in the histogram. Use fewer bins for coarse overview, more bins for detailed distribution.

CRITICAL: Only for quantitative continuous data to see distribution shape, outliers, skewness.
Do NOT use for: categorical data (use count-plot), relationships between columns (use scatter-plot), time series trends (use line-chart).`,
    inputSchema: HistogramToolParameters,
    execute: async (params) => {
      try {
        const dataTable = deps.resolveTable(params.tableName);

        validateHistogramSettings({
          dataTable,
          settings: params.settings,
        });

        const chartConfig: HistogramChartConfig = {
          chartType: 'histogram' as const,
          settings: params.settings,
        };

        deps.addChart({
          tableName: params.tableName,
          config: chartConfig,
        });

        return {
          llmResult: {
            success: true,
            details: `Generated histogram configuration for "${params.settings.field}".`,
            data: chartConfig,
          },
        };
      } catch (error) {
        return {
          llmResult: {
            success: false,
            errorMessage:
              error instanceof Error ? error.message : String(error),
          },
        };
      }
    },
  });
}
