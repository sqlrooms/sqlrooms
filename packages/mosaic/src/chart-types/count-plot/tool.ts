import {tool} from 'ai';
import {z} from 'zod';
import {CountPlotChartSettings} from './schema';
import {BaseChartToolParameters} from '../tool-schemas';
import {type DashboardToolDeps} from '../base-types';
import {validateColumnExists} from '../tool-validation';
import {CATEGORICAL_COLUMN_TYPES} from '../../chart-builders/constants';
import {createOrUpdateChartPanel} from '../chart-tool-helpers';

export const CountPlotToolParameters = BaseChartToolParameters.extend({
  settings: CountPlotChartSettings.required(),
});

export type CountPlotToolParams = z.infer<typeof CountPlotToolParameters>;

export function createCountPlotAiTool(deps: DashboardToolDeps) {
  return tool({
    description: `Count plot: horizontal bar chart showing frequency of categorical/text values. Counts how many times each unique value appears.

Use when: user asks to "count", "frequency of", "how many", "breakdown by category", "distribution of [text/category column]".
Example queries: "count by land use type", "how many features per administrative region", "frequency of terrain types", "breakdown by zone classification", "count parcels by ownership type".

Required: field must be categorical/text (${CATEGORICAL_COLUMN_TYPES.join(', ')}).

To UPDATE an existing count plot: provide the panelId parameter. Otherwise creates new panel.

CRITICAL: Only for categorical data (text, categories, enums).
Do NOT use for: numeric distributions (use histogram), relationships between columns (use bubble-chart), time series (use line-chart).`,
    inputSchema: CountPlotToolParameters,
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

        // Validate settings - expect categorical columns
        validateColumnExists(
          params.settings.field,
          CATEGORICAL_COLUMN_TYPES,
          columns,
          'field',
        );

        const result = createOrUpdateChartPanel(deps, {
          panelId: params.panelId,
          dashboardId: artifactId,
          tableName,
          title: `Count plot of ${params.settings.field}`,
          config: {
            chartType: 'count-plot',
            settings: params.settings,
          },
        });

        return {
          llmResult: {
            success: true,
            details: params.panelId
              ? `Updated count plot "${result.title}".`
              : `Created count plot "${result.title}".`,
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
