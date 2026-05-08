import {tool} from 'ai';
import {z} from 'zod';
import {CountPlotAiChartSettings} from './schema';
import {BaseChartToolParameters} from '../tool-schemas';
import {type ChartToolDeps} from '../tool-types';
import {validateColumnExists} from '../tool-validation';
import {QUANTITATIVE_COLUMN_TYPES} from '../../chart-builders/constants';

export const CountPlotToolParameters = BaseChartToolParameters.extend({
  settings: CountPlotAiChartSettings,
});

export type CountPlotToolParams = z.infer<typeof CountPlotToolParameters>;

export function createCountPlotAiTool(deps: ChartToolDeps) {
  return tool({
    description: 'Create a count plot showing frequency of categorical values.',
    inputSchema: CountPlotToolParameters,
    execute: async (params) => {
      try {
        const {artifactId, tableName, columns} = deps.resolveResources(params);

        // Validate settings
        validateColumnExists(
          params.settings.field,
          QUANTITATIVE_COLUMN_TYPES,
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
