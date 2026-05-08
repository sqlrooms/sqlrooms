import {tool} from 'ai';
import {z} from 'zod';
import {HistogramChartSettings} from './schema';
import {BaseChartToolParameters, type ChartToolDeps} from '../tool-helpers';
import {QUANTITATIVE_COLUMN_TYPES} from '../../chart-builders/constants';

export const HistogramToolParameters = BaseChartToolParameters.extend({
  settings: HistogramChartSettings,
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
        deps.validateField(
          'field',
          params.settings.field,
          {
            required: true,
            types: QUANTITATIVE_COLUMN_TYPES,
          },
          columns,
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
