import {tool} from 'ai';
import {z} from 'zod';
import {BubbleChartSettings} from './schema';
import {BaseChartToolParameters} from '../tool-schemas';
import {type ChartToolDeps} from '../base-types';
import {validateColumnExists} from '../tool-validation';
import {NUMERIC_COLUMN_TYPES} from '../../chart-builders/constants';

export const BubbleChartToolParameters = BaseChartToolParameters.extend({
  settings: BubbleChartSettings.required(),
});

export type BubbleChartToolParams = z.infer<typeof BubbleChartToolParameters>;

export function createBubbleChartAiTool(deps: ChartToolDeps) {
  return tool({
    description:
      'Create a bubble/scatter chart with x, y position and optional size.',
    inputSchema: BubbleChartToolParameters,
    execute: async (params) => {
      try {
        const {artifactId, tableName, columns} = deps.resolveResources(params);

        // Validate settings
        validateColumnExists(
          params.settings.x,
          NUMERIC_COLUMN_TYPES,
          columns,
          'x',
        );

        validateColumnExists(
          params.settings.y,
          NUMERIC_COLUMN_TYPES,
          columns,
          'y',
        );

        const title =
          params.settings.x && params.settings.y
            ? `Bubble chart - ${params.settings.x} vs ${params.settings.y}`
            : 'Bubble chart';

        const result = deps.createChart({
          artifactId,
          tableName,
          config: {
            chartType: 'bubble-chart',
            settings: params.settings,
          },
          title,
        });

        return {
          llmResult: {
            success: true,
            details: `Created bubble chart "${result.title}".`,
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
