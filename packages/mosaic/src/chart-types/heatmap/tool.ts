import {tool} from 'ai';
import {z} from 'zod';
import {HeatmapChartSettings} from './schema';
import {BaseChartToolParameters, type ChartToolDeps} from '../tool-helpers';

export const HeatmapToolParameters = BaseChartToolParameters.extend({
  settings: HeatmapChartSettings,
});

export type HeatmapToolParams = z.infer<typeof HeatmapToolParameters>;

export function createHeatmapAiTool(deps: ChartToolDeps) {
  return tool({
    description: 'Create a heatmap with x, y coordinates and color intensity.',
    inputSchema: HeatmapToolParameters,
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
              types: ['DOUBLE', 'BIGINT', 'INTEGER', 'FLOAT', 'VARCHAR'],
              label: 'X Field',
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
              types: ['DOUBLE', 'BIGINT', 'INTEGER', 'FLOAT', 'VARCHAR'],
              label: 'Y Field',
            },
            columns,
          );
        }

        const title =
          params.settings.x && params.settings.y
            ? `Heatmap - ${params.settings.x} vs ${params.settings.y}`
            : 'Heatmap';

        const result = deps.createChart({
          artifactId,
          tableName,
          chartType: 'heatmap',
          settings: params.settings,
          title,
        });

        return {
          llmResult: {
            success: true,
            details: `Created heatmap "${result.title}".`,
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
