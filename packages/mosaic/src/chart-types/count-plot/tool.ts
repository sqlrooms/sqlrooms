import {tool} from 'ai';
import {z} from 'zod';
import {CountPlotChartSettings} from './schema';
import {BaseChartToolParameters, type ChartToolDeps} from '../tool-helpers';
import {QUANTITATIVE_COLUMN_TYPES} from '../../chart-builders/constants';

export const CountPlotToolParameters = BaseChartToolParameters.extend({
  settings: CountPlotChartSettings,
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
        deps.validateField(
          'field',
          params.settings.field,
          {
            required: true,
            types: QUANTITATIVE_COLUMN_TYPES,
          },
          columns,
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
