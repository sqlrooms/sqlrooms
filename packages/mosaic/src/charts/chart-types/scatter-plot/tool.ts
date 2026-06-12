import {tool} from 'ai';
import {z} from 'zod';
import {ScatterPlotChartConfig, ScatterPlotChartSettings} from './schema';
import {BaseChartToolParameters} from '../../../ai/tool-schemas';
import {NUMERIC_COLUMN_TYPES} from '../../../column-types-utils';
import {ChartToolDeps, ChartToolOutput} from '../tool-types';
import {validateScatterPlotSettings} from './validation';

export const ScatterPlotToolParameters = BaseChartToolParameters.extend({
  settings: ScatterPlotChartSettings.required(),
});

export type ScatterPlotToolParams = z.infer<typeof ScatterPlotToolParameters>;

export function createScatterPlotAiTool(deps: ChartToolDeps) {
  return tool<ScatterPlotToolParams, ChartToolOutput<ScatterPlotChartConfig>>({
    description: `Scatter chart: plots individual points positioned by two numeric columns (x, y), with optional size dimension.

Use when: user asks to "plot X vs Y", "show relationship between", "scatter plot", "correlation", "compare two numeric columns".
Example queries: "plot latitude vs longitude", "show correlation between elevation and temperature", "visualize coordinates sized by population", "plot area vs population density".

Required: x and y must be numeric (${NUMERIC_COLUMN_TYPES.join(', ')}).
Optional: size can encode a third numeric dimension (magnitude, frequency, count).

IMPORTANT: Scatter charts render ALL rows as individual points. Do NOT create scatter charts for tables with more than ${deps.maxDataPoints.toLocaleString()} rows - use aggregated visualizations instead (histogram, count-plot, line-chart with time intervals, or heatmap).

Do NOT use for: distributions (use histogram), categorical counts (use count-plot), trends over time (use line-chart), or large datasets (>${deps.maxDataPoints.toLocaleString()} rows).`,
    inputSchema: ScatterPlotToolParameters,
    execute: async (params) => {
      try {
        const dataTable = deps.resolveTable(params.tableName);

        validateScatterPlotSettings({
          dataTable,
          settings: params.settings,
        });

        return {
          llmResult: {
            success: true,
            details: `Generated scatter chart configuration.`,
            data: {
              chartType: 'scatter-plot',
              settings: params.settings,
            },
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
