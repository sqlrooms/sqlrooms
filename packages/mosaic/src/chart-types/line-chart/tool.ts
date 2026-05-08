import {tool} from 'ai';
import {z} from 'zod';
import {LineChartSettings} from './schema';
import {BaseChartToolParameters, type ChartToolDeps} from '../tool-helpers';
import {
  NUMERIC_COLUMN_TYPES,
  QUANTITATIVE_COLUMN_TYPES,
} from '../../chart-builders/constants';

export const LineChartToolParameters = BaseChartToolParameters.extend({
  settings: LineChartSettings,
});

export type LineChartToolParams = z.infer<typeof LineChartToolParameters>;

export function createLineChartAiTool(deps: ChartToolDeps) {
  return tool({
    description:
      'Create a line chart for trends over time. Use yFields array with {field: string, aggregate?: "sum"|"avg"|"min"|"max"} for aggregation. Set xInterval for temporal binning (year, month, day, etc.).',
    inputSchema: LineChartToolParameters,
    execute: async (params) => {
      try {
        const {artifactId, tableName, columns} = deps.resolveResources(params);

        // Validate settings
        if (params.settings.x) {
          deps.validateField(
            'x',
            params.settings.x,
            {
              required: true,
              types: QUANTITATIVE_COLUMN_TYPES,
            },
            columns,
          );
        }

        if (params.settings.yFields && Array.isArray(params.settings.yFields)) {
          for (const yField of params.settings.yFields) {
            deps.validateField(
              'yFields',
              yField.field,
              {
                required: true,
                types: NUMERIC_COLUMN_TYPES,
              },
              columns,
            );
          }
        }

        const title = params.settings.x
          ? `Line chart - ${params.settings.yFields?.map((f) => f.field).join(', ') || ''} over ${params.settings.x}`
          : 'Line chart';

        const result = deps.createChart({
          artifactId,
          tableName,
          config: {
            chartType: 'line-chart',
            settings: params.settings,
          },
          title,
        });

        return {
          llmResult: {
            success: true,
            details: `Created line chart "${result.title}".`,
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
