import {tool} from 'ai';
import {z} from 'zod';
import {CountPlotChartConfig, CountPlotChartSettings} from './schema';
import {BaseChartToolInput} from '../../../ai/tool-schemas';
import {CATEGORICAL_COLUMN_TYPES} from '../../../column-types-utils';
import {ChartToolParams, ChartToolOutput} from '../tool-types';
import {validateCountPlotSettings} from './validation';
import {ensureTable} from '../../../ai/tool-helpers';

export const CountPlotToolInput = BaseChartToolInput.extend({
  settings: CountPlotChartSettings.required(),
});

export type CountPlotToolInput = z.infer<typeof CountPlotToolInput>;

export function createCountPlotAiTool({
  databaseAdapter,
  addChart,
}: ChartToolParams) {
  return tool<CountPlotToolInput, ChartToolOutput<CountPlotChartConfig>>({
    description: `Count plot: horizontal bar chart showing frequency of categorical/text values. Counts how many times each unique value appears.

Use when: user asks to "count", "frequency of", "how many", "breakdown by category", "distribution of [text/category column]".
Example queries: "count by land use type", "how many features per administrative region", "frequency of terrain types", "breakdown by zone classification", "count parcels by ownership type".

Required: field must be categorical/text (${CATEGORICAL_COLUMN_TYPES.join(', ')}).

NOTE: Count plots aggregate by counting unique values, so they handle large datasets efficiently (no data point limit).

CRITICAL: Only for categorical data (text, categories, enums).
Do NOT use for: numeric distributions (use histogram), relationships between columns (use scatter-plot), time series (use line-chart).`,
    inputSchema: CountPlotToolInput,
    execute: async ({tableName, title, settings}) => {
      try {
        const dataTable = ensureTable(databaseAdapter, tableName);

        validateCountPlotSettings({
          dataTable,
          settings,
        });

        const chartConfig: CountPlotChartConfig = {
          chartType: 'count-plot' as const,
          settings,
        };

        addChart({
          tableName,
          title,
          config: chartConfig,
        });

        return {
          success: true,
          details: `Generated count plot configuration for "${settings.field}".`,
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
