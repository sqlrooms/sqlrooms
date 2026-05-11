import {tool} from 'ai';
import {z} from 'zod';
import {BoxPlotChartSettings} from './schema';
import {BaseChartToolParameters} from '../tool-schemas';
import {type ChartToolDeps} from '../base-types';
import {validateColumnExists} from '../tool-validation';
import {NUMERIC_COLUMN_TYPES} from '../../chart-builders/constants';

export const BoxPlotToolParameters = BaseChartToolParameters.extend({
  settings: BoxPlotChartSettings.required(),
});

export type BoxPlotToolParams = z.infer<typeof BoxPlotToolParameters>;

export function createBoxPlotAiTool(deps: ChartToolDeps) {
  return tool({
    description: 'Create a box plot showing distribution statistics.',
    inputSchema: BoxPlotToolParameters,
    execute: async (params) => {
      try {
        const {artifactId, tableName, columns} = deps.resolveResources(params);

        // Validate settings
        validateColumnExists(params.settings.x, undefined, columns, 'x');
        validateColumnExists(
          params.settings.y,
          NUMERIC_COLUMN_TYPES,
          columns,
          'y',
        );

        const title = `Box plot - ${params.settings.y} by ${params.settings.x}`;

        const result = deps.createChart({
          artifactId,
          tableName,
          config: {
            chartType: 'box-plot',
            settings: params.settings,
          },
          title,
        });

        return {
          llmResult: {
            success: true,
            details: `Created box plot "${result.title}".`,
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
