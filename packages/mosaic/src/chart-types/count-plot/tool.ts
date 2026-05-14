import {tool} from 'ai';
import {z} from 'zod';
import {CountPlotChartSettings} from './schema';
import {BaseChartToolParameters} from '../tool-schemas';
import {type ChartToolDeps} from '../base-types';
import {validateColumnExists} from '../tool-validation';
import {CATEGORICAL_COLUMN_TYPES} from '../../chart-builders/constants';

export const CountPlotToolParameters = BaseChartToolParameters.extend({
  settings: CountPlotChartSettings.required(),
});

export type CountPlotToolParams = z.infer<typeof CountPlotToolParameters>;

export function createCountPlotAiTool(deps: ChartToolDeps) {
  return tool({
    description: `Count plot: horizontal bar chart showing frequency of categorical/text values. Counts how many times each unique value appears.

Use when: user asks to "count", "frequency of", "how many", "breakdown by category", "distribution of [text/category column]".
Example queries: "count by land use type", "how many features per administrative region", "frequency of terrain types", "breakdown by zone classification", "count parcels by ownership type".

Required: field must be categorical/text (${CATEGORICAL_COLUMN_TYPES.join(', ')}).

CRITICAL: Only for categorical data (text, categories, enums).
Do NOT use for: numeric distributions (use histogram), relationships between columns (use bubble-chart), time series (use line-chart).`,
    inputSchema: CountPlotToolParameters,
    execute: async (params, context) => {
      try {
        const {artifactId, tableName, columns} = deps.resolveResources(
          params,
          context,
        );

        // Validate settings - expect categorical columns
        validateColumnExists(
          params.settings.field,
          CATEGORICAL_COLUMN_TYPES,
          columns,
          'field',
        );

        const title = `Count plot of ${params.settings.field}`;

        const result = deps.createChart({
          artifactId,
          tableName,
          config: {
            chartType: 'count-plot',
            settings: params.settings,
          },
          title,
        });

        return {
          llmResult: {
            success: true,
            details: `Created count plot "${result.title}".`,
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
