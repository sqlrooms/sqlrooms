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
    description:
      'Create a horizontal bar chart showing frequency/count of categorical values. Use for discrete/categorical columns (text, enums), not numeric distributions.',
    inputSchema: CountPlotToolParameters,
    execute: async (params) => {
      try {
        const {artifactId, tableName, columns} = deps.resolveResources(params);

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
