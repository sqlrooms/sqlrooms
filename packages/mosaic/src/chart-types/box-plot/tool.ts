import {tool} from 'ai';
import {z} from 'zod';
import {BoxPlotChartSettings} from './schema';
import {BaseChartToolParameters, type ChartToolDeps} from '../tool-helpers';

export const BoxPlotToolParameters = BaseChartToolParameters.extend({
  settings: BoxPlotChartSettings,
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
        if (params.settings.x) {
          deps.validateField(
            'x',
            params.settings.x,
            {
              required: false,
              types: ['VARCHAR', 'INTEGER', 'BIGINT', 'BOOLEAN'],
              label: 'X Field (category)',
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
              types: ['DOUBLE', 'BIGINT', 'INTEGER', 'FLOAT'],
              label: 'Y Field (numeric)',
            },
            columns,
          );
        }

        const title = params.settings.x
          ? `Box plot - ${params.settings.y} by ${params.settings.x}`
          : `Box plot of ${params.settings.y}`;

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
