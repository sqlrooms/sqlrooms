import {tool} from 'ai';
import {z} from 'zod';
import {
  HistogramChartConfig,
  HistogramChartSettings,
  MIN_BINS_COUNT,
  MAX_BINS_COUNT,
  DEFAULT_BINS_COUNT,
} from './schema';
import {BaseChartToolInput} from '../../../ai/tool-schemas';
import {QUANTITATIVE_COLUMN_TYPES} from '../../../column-types-utils';
import {ChartToolParams, ChartToolOutput} from '../tool-types';
import {validateHistogramSettings} from './validation';
import {ensureTable} from '../../../ai/tool-helpers';

/**
 * Input schema for the histogram chart tool.
 * Extends base chart input with histogram-specific settings including field and bin configuration.
 */
export const HistogramToolInput = BaseChartToolInput.extend({
  settings: HistogramChartSettings.required(),
});

/**
 * Type representing validated input for histogram chart creation.
 */
export type HistogramToolInput = z.infer<typeof HistogramToolInput>;

/**
 * Creates an AI tool for generating histogram charts.
 * Histograms show distribution of numeric values by grouping data into bins/ranges.
 *
 * @param params - Chart tool parameters
 * @param params.databaseAdapter - Database adapter for table and column validation
 * @param params.addChart - Function to add the generated chart to the target artifact
 * @returns AI tool instance for histogram chart creation
 */
export function createHistogramAiTool({
  databaseAdapter,
  addChart,
}: ChartToolParams) {
  return tool<HistogramToolInput, ChartToolOutput<HistogramChartConfig>>({
    description: `Histogram: shows distribution of numeric values by automatically grouping data into bins/ranges.

Use when: user asks about "distribution of [numeric column]", "spread of", "range of", "how values are distributed", "show histogram".
Example queries: "distribution of population density", "show elevation distribution", "histogram of parcel areas", "how are building heights spread", "temperature range distribution".

Required: field must be quantitative not text/categorical: (${QUANTITATIVE_COLUMN_TYPES.join(', ')}).

NOTE: Histograms automatically bin data into ranges and aggregate counts, so they handle large datasets efficiently (no data point limit).

Optional: maxBins (${MIN_BINS_COUNT}-${MAX_BINS_COUNT}, default ${DEFAULT_BINS_COUNT}) controls the number of bins/bars in the histogram. Use fewer bins for coarse overview, more bins for detailed distribution.

CRITICAL: Only for quantitative continuous data to see distribution shape, outliers, skewness.
Do NOT use for: categorical data (use count-plot), relationships between columns (use scatter-plot), time series trends (use line-chart).`,
    inputSchema: HistogramToolInput,
    execute: async ({tableName, settings, title, panelId}) => {
      try {
        const dataTable = ensureTable(databaseAdapter, tableName);

        validateHistogramSettings({
          dataTable,
          settings,
        });

        const chartConfig: HistogramChartConfig = {
          chartType: 'histogram' as const,
          settings,
        };

        await addChart({
          tableName,
          panelId,
          config: chartConfig,
          title,
        });

        return {
          success: true,
          details: `Generated histogram configuration for "${settings.field}".`,
          data: chartConfig,
        };
      } catch (error) {
        return {
          success: false,
          errorMessage: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });
}
