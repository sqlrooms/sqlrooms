import {tool} from 'ai';
import {z} from 'zod';
import {
  CountPlotChartConfig,
  CountPlotChartSettings,
  CountPlotMetric,
  CountPlotSort,
  MAX_COUNT_PLOT_MAX_BARS,
  MIN_COUNT_PLOT_MAX_BARS,
} from './schema';
import {BaseChartToolInput} from '../../../ai/tool-schemas';
import {CATEGORICAL_COLUMN_TYPES} from '../../../column-types-utils';
import {ChartToolParams, ChartToolOutput} from '../tool-types';
import {validateCountPlotSettings} from './validation';
import {ensureTable} from '../../../ai/tool-helpers';
import {AggregateFunction} from '../../../schemas';

const AGGREGATE_FUNCTIONS = AggregateFunction.options;

const CountPlotToolSettings = z.object({
  field: z
    .string()
    .min(1)
    .describe('Categorical column used to group the horizontal bars'),
  metric: CountPlotMetric.optional().describe(
    'Choose count for repeated raw observations or aggregate for an existing numeric measure. Omission is tolerated for compatibility.',
  ),
  valueField: z
    .string()
    .min(1)
    .optional()
    .describe(
      'Numeric measure column required when metric is aggregate. Its presence implies aggregate when metric is omitted.',
    ),
  aggregate: AggregateFunction.optional().describe(
    'Aggregation function for the numeric measure column; defaults to sum',
  ),
  sort: CountPlotSort.optional().describe(
    'Sort categories by metric value or label; defaults to value-desc',
  ),
  maxBars: z
    .number()
    .int()
    .min(MIN_COUNT_PLOT_MAX_BARS)
    .max(MAX_COUNT_PLOT_MAX_BARS)
    .optional()
    .describe('Maximum number of category bars to display; defaults to 10'),
  leftMargin: z
    .number()
    .int()
    .min(0)
    .max(320)
    .optional()
    .describe('Manual left margin in pixels; omit to auto-size from metadata'),
});

export const CountPlotToolInput = BaseChartToolInput.extend({
  settings: CountPlotToolSettings,
});

export type CountPlotToolInput = z.infer<typeof CountPlotToolInput>;

export function createCountPlotAiTool({
  databaseAdapter,
  addChart,
}: ChartToolParams) {
  return tool<CountPlotToolInput, ChartToolOutput<CountPlotChartConfig>>({
    description: `Categorical horizontal bar chart. Choose the metric from the grain of the source table, not merely from words such as "count" in the user's request.

Use when: user asks to "count", "frequency of", "how many", "breakdown by category", "distribution of [text/category column]".
Example queries: "count by land use type", "how many features per administrative region", "frequency of terrain types", "breakdown by zone classification", "count parcels by ownership type", "total length by road class".

Required: field must be categorical/text (${CATEGORICAL_COLUMN_TYPES.join(', ')}).
Metric decision:
- Use metric "count" only for raw/event-level data where each source row is an observation and field values repeat. Example: venue rows with category -> {field: "category", metric: "count"}.
- Use metric "aggregate" when the table already contains a numeric measure, especially a GROUP BY/query result with one row per category. Set valueField to that measure and aggregate to one of ${AGGREGATE_FUNCTIONS.join(', ')}. Example: rows {category, venue_count} -> {field: "category", metric: "aggregate", valueField: "venue_count", aggregate: "sum"}.
- NEVER use metric "count" when field is unique at the current table grain: every bar would be 1. Use the numeric measure column or switch to the raw-grain source table.

Optional sorting: sort can be "value-desc", "value-asc", "label-asc", or "label-desc".
Optional density: maxBars caps the number of displayed categories.

NOTE: Count plots aggregate by counting unique values, so they handle large datasets efficiently (no data point limit).

CRITICAL: Only for categorical data (text, categories, enums).
Do NOT use for: numeric distributions (use histogram), relationships between columns (use scatter-plot), time series (use line-chart).`,
    inputSchema: CountPlotToolInput,
    execute: async ({tableName, title, settings, panelId}) => {
      try {
        const dataTable = ensureTable(databaseAdapter, tableName);
        const normalizedSettings = CountPlotChartSettings.parse({
          ...settings,
          metric:
            settings.metric ?? (settings.valueField ? 'aggregate' : 'count'),
        });

        validateCountPlotSettings({
          dataTable,
          settings: normalizedSettings,
        });

        const chartConfig: CountPlotChartConfig = {
          chartType: 'count-plot' as const,
          settings: normalizedSettings,
        };

        await addChart({
          tableName,
          panelId,
          title,
          config: chartConfig,
        });

        return {
          success: true,
          details: `Generated count plot configuration for "${normalizedSettings.field}" using ${normalizedSettings.metric === 'aggregate' ? `${normalizedSettings.aggregate}(${normalizedSettings.valueField})` : 'row count'}.`,
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
