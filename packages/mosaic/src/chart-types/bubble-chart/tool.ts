import {tool} from 'ai';
import {z} from 'zod';
import {BubbleChartSettings} from './schema';
import {BaseChartToolParameters, type ChartToolDeps} from '../tool-helpers';
import {NUMERIC_COLUMN_TYPES} from '../../chart-builders/constants';

export const BubbleChartToolParameters = BaseChartToolParameters.extend({
  settings: BubbleChartSettings,
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
        if (params.settings.x) {
          deps.validateField(
            'x',
            params.settings.x,
            {
              required: true,
              types: NUMERIC_COLUMN_TYPES,
            },
            columns,
          );
        }

        if (params.settings.y) {
          deps.validateField(
            'y',
            params.settings.y,
            {
              required: true,
              types: NUMERIC_COLUMN_TYPES,
            },
            columns,
          );
        }

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
