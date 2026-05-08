import {tool} from 'ai';
import {z} from 'zod';
import {HistogramAiChartSettings} from './schema';
import {BaseChartToolParameters} from '../tool-schemas';
import {type ChartToolDeps} from '../tool-types';
import {validateColumnExists} from '../tool-validation';
import {QUANTITATIVE_COLUMN_TYPES} from '../../chart-builders/constants';

export const HistogramToolParameters = BaseChartToolParameters.extend({
  settings: HistogramAiChartSettings,
});

export type HistogramToolParams = z.infer<typeof HistogramToolParameters>;

export function createHistogramAiTool(deps: ChartToolDeps) {
  return tool({
    description:
      'Create a histogram showing the distribution of a single numeric column.',
    inputSchema: HistogramToolParameters,
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

        const title = `Histogram of ${params.settings.field}`;

        const result = deps.createChart({
          artifactId,
          tableName,
          config: {
            chartType: 'histogram',
            settings: params.settings,
          },
          title,
        });

        return {
          llmResult: {
            success: true,
            details: `Created histogram "${result.title}".`,
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
