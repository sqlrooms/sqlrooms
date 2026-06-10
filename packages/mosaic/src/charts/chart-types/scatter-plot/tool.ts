import {tool} from 'ai';
import {z} from 'zod';
import {ScatterPlotChartSettings} from './schema';
import {BaseChartToolParameters} from '../../../ai/tool-schemas';
import {type DashboardToolDeps} from '../base-types';
import {validateColumnExists} from '../../../ai/tool-validation';
import {NUMERIC_COLUMN_TYPES} from '../../../column-types-utils';
import {createOrUpdateChartPanel} from '../../../ai/tool-helpers';

export const ScatterPlotToolParameters = BaseChartToolParameters.extend({
  settings: ScatterPlotChartSettings.required(),
});

export type ScatterPlotToolParams = z.infer<typeof ScatterPlotToolParameters>;

export function createScatterPlotAiTool(deps: DashboardToolDeps) {
  return tool({
    description: `Scatter chart: plots individual points positioned by two numeric columns (x, y), with optional size dimension.

Use when: user asks to "plot X vs Y", "show relationship between", "scatter plot", "correlation", "compare two numeric columns".
Example queries: "plot latitude vs longitude", "show correlation between elevation and temperature", "visualize coordinates sized by population", "plot area vs population density".

Required: x and y must be numeric (${NUMERIC_COLUMN_TYPES.join(', ')}).
Optional: size can encode a third numeric dimension (magnitude, frequency, count).

IMPORTANT: Scatter charts render ALL rows as individual points. Do NOT create scatter charts for tables with more than ${deps.maxDataPoints.toLocaleString()} rows - use aggregated visualizations instead (histogram, count-plot, line-chart with time intervals, or heatmap).

To UPDATE an existing scatter chart: provide the panelId parameter. Otherwise creates new panel.

Do NOT use for: distributions (use histogram), categorical counts (use count-plot), trends over time (use line-chart), or large datasets (>${deps.maxDataPoints.toLocaleString()} rows).`,
    inputSchema: ScatterPlotToolParameters,
    execute: async (params, context) => {
      try {
        const artifactId = deps.resolveArtifact(
          params.artifactId,
          params.createArtifactIfMissing,
          context,
        );
        const {tableName, columns} = deps.resolveTable(
          artifactId,
          params.tableName,
        );

        // Validate settings
        validateColumnExists(
          params.settings.x,
          NUMERIC_COLUMN_TYPES,
          columns,
          'x',
        );

        validateColumnExists(
          params.settings.y,
          NUMERIC_COLUMN_TYPES,
          columns,
          'y',
        );

        const result = createOrUpdateChartPanel(deps, {
          panelId: params.panelId,
          dashboardId: artifactId,
          tableName,
          title:
            params.settings.x && params.settings.y
              ? `Scatter chart - ${params.settings.x} vs ${params.settings.y}`
              : 'Scatter chart',
          config: {
            chartType: 'scatter-plot',
            settings: params.settings,
          },
        });

        return {
          llmResult: {
            success: true,
            details: params.panelId
              ? `Updated scatter chart "${result.title}".`
              : `Created scatter chart "${result.title}".`,
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
