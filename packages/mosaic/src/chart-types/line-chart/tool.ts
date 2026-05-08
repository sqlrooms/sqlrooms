import {tool} from 'ai';
import {z} from 'zod';
import {LineChartSettings} from './schema';
import {BaseChartToolParameters} from '../tool-schemas';
import {type ChartToolDeps} from '../tool-types';
import {validateColumnExists} from '../tool-validation';
import {
  NUMERIC_COLUMN_TYPES,
  QUANTITATIVE_COLUMN_TYPES,
} from '../../chart-builders/constants';

export const LineChartToolParameters = BaseChartToolParameters.extend({
  settings: LineChartSettings.required(),
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
        validateColumnExists(
          params.settings.x,
          QUANTITATIVE_COLUMN_TYPES,
          columns,
          'x',
        );

        for (const yField of params.settings.yFields) {
          validateColumnExists(
            yField.field,
            NUMERIC_COLUMN_TYPES,
            columns,
            'yFields',
          );
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
