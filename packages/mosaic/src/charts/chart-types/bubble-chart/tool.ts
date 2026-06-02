import {tool} from 'ai';
import {z} from 'zod';
import {BubbleChartSettings} from './schema';
import {BaseChartToolParameters} from '../../../ai/tool-schemas';
import {type DashboardToolDeps} from '../base-types';
import {validateColumnExists} from '../../../ai/tool-validation';
import {NUMERIC_COLUMN_TYPES} from '../../../chart-builders/constants';
import {createOrUpdateChartPanel} from '../../../ai/tool-helpers';

export const BubbleChartToolParameters = BaseChartToolParameters.extend({
  settings: BubbleChartSettings.required(),
});

export type BubbleChartToolParams = z.infer<typeof BubbleChartToolParameters>;

export function createBubbleChartAiTool(deps: DashboardToolDeps) {
  return tool({
    description: `Bubble/scatter chart: plots individual points positioned by two numeric columns (x, y), with optional size dimension.

Use when: user asks to "plot X vs Y", "show relationship between", "scatter plot", "correlation", "compare two numeric columns".
Example queries: "plot latitude vs longitude", "show correlation between elevation and temperature", "visualize coordinates sized by population", "plot area vs population density".

Required: x and y must be numeric (${NUMERIC_COLUMN_TYPES.join(', ')}).
Optional: size can encode a third numeric dimension (magnitude, frequency, count).

IMPORTANT: Bubble charts render ALL rows as individual points. Do NOT create bubble charts for tables with more than ${deps.maxDataPoints.toLocaleString()} rows - use aggregated visualizations instead (histogram, count-plot, line-chart with time intervals, or heatmap).

To UPDATE an existing bubble chart: provide the panelId parameter. Otherwise creates new panel.

Do NOT use for: distributions (use histogram), categorical counts (use count-plot), trends over time (use line-chart), or large datasets (>${deps.maxDataPoints.toLocaleString()} rows).`,
    inputSchema: BubbleChartToolParameters,
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
              ? `Bubble chart - ${params.settings.x} vs ${params.settings.y}`
              : 'Bubble chart',
          config: {
            chartType: 'bubble-chart',
            settings: params.settings,
          },
        });

        return {
          llmResult: {
            success: true,
            details: params.panelId
              ? `Updated bubble chart "${result.title}".`
              : `Created bubble chart "${result.title}".`,
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
