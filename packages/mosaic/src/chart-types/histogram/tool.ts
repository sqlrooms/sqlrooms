import {tool} from 'ai';
import {z} from 'zod';
import {
  HistogramChartSettings,
  MIN_BINS_COUNT,
  MAX_BINS_COUNT,
  DEFAULT_BINS_COUNT,
} from './schema';
import {BaseChartToolParameters} from '../tool-schemas';
import type {ChartToolDeps} from '../base-types';
import {validateColumnExists} from '../tool-validation';
import {QUANTITATIVE_COLUMN_TYPES} from '../../chart-builders/constants';

export const HistogramToolParameters = BaseChartToolParameters.extend({
  settings: HistogramChartSettings.required(),
});

export type HistogramToolParams = z.infer<typeof HistogramToolParameters>;

export function createHistogramAiTool(deps: ChartToolDeps) {
  return tool({
    description: `Histogram: shows distribution of numeric values by automatically grouping data into bins/ranges.

Use when: user asks about "distribution of [numeric column]", "spread of", "range of", "how values are distributed", "show histogram".
Example queries: "distribution of population density", "show elevation distribution", "histogram of parcel areas", "how are building heights spread", "temperature range distribution".

Required: field must be quantitative not text/categorical: (${QUANTITATIVE_COLUMN_TYPES.join(', ')}).

Optional: maxBins (${MIN_BINS_COUNT}-${MAX_BINS_COUNT}, default ${DEFAULT_BINS_COUNT}) controls the number of bins/bars in the histogram. Use fewer bins for coarse overview, more bins for detailed distribution.

CRITICAL: Only for quantitative continuous data to see distribution shape, outliers, skewness.
Do NOT use for: categorical data (use count-plot), relationships between columns (use bubble-chart), time series trends (use line-chart).`,
    inputSchema: HistogramToolParameters,
    execute: async (params, context) => {
      try {
        const {artifactId, tableName, columns} = deps.resolveResources(
          params,
          context,
        );

        // Validate settings
        validateColumnExists(
          params.settings.field,
          QUANTITATIVE_COLUMN_TYPES,
          columns,
          'field',
        );

        const title = `Histogram of ${params.settings.field}`;

        const result = deps.createChart({
          artifactId,
          tableName,
          config: {
            chartType: 'histogram',
            settings: params.settings,
          },
          title,
        });

        return {
          llmResult: {
            success: true,
            details: `Created histogram "${result.title}".`,
            data: result,
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
