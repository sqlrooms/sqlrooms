import {tool} from 'ai';
import {z} from 'zod';
import {ScatterPlotChartConfig, ScatterPlotChartSettings} from './schema';
import {BaseChartToolInput} from '../../../ai/tool-schemas';
import {NUMERIC_COLUMN_TYPES} from '../../../column-types-utils';
import {ChartToolParams, ChartToolOutput} from '../tool-types';
import {validateScatterPlotSettings} from './validation';
import {ensureTable} from '../../../ai/tool-helpers';

export const ScatterPlotToolInput = BaseChartToolInput.extend({
  settings: ScatterPlotChartSettings.required(),
});

export type ScatterPlotToolInput = z.infer<typeof ScatterPlotToolInput>;

export function createScatterPlotAiTool({
  databaseAdapter,
  addChart,
  maxDataPoints,
}: ChartToolParams) {
  return tool<ScatterPlotToolInput, ChartToolOutput<ScatterPlotChartConfig>>({
    description: `Scatter chart: plots individual points positioned by two numeric columns (x, y), with optional size dimension.

Use when: user asks to "plot X vs Y", "show relationship between", "scatter plot", "correlation", "compare two numeric columns".
Example queries: "plot latitude vs longitude", "show correlation between elevation and temperature", "visualize coordinates sized by population", "plot area vs population density".

Required: x and y must be numeric (${NUMERIC_COLUMN_TYPES.join(', ')}).
Optional: size can encode a third numeric dimension (magnitude, frequency, count).

IMPORTANT: Scatter charts render ALL rows as individual points. Do NOT create scatter charts for tables with more than ${maxDataPoints.toLocaleString()} rows - use aggregated visualizations instead (histogram, count-plot, line-chart with time intervals, or heatmap).

Do NOT use for: distributions (use histogram), categorical counts (use count-plot), trends over time (use line-chart), or large datasets (>${maxDataPoints.toLocaleString()} rows).`,
    inputSchema: ScatterPlotToolInput,
    execute: async ({tableName, title, settings}) => {
      try {
        const dataTable = ensureTable(databaseAdapter, tableName);

        validateScatterPlotSettings({
          dataTable,
          settings,
        });

        const chartConfig: ScatterPlotChartConfig = {
          chartType: 'scatter-plot' as const,
          settings,
        };

        addChart({
          tableName,
          config: chartConfig,
          title,
        });

        return {
          success: true,
          details: `Generated scatter chart configuration.`,
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
