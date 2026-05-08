import {tool} from 'ai';
import {z} from 'zod';
import {HeatmapAiChartSettings} from './schema';
import {BaseChartToolParameters} from '../tool-schemas';
import {type ChartToolDeps} from '../tool-types';
import {validateColumnExists} from '../tool-validation';
import {NUMERIC_COLUMN_TYPES} from '../../chart-builders/constants';

export const HeatmapToolParameters = BaseChartToolParameters.extend({
  settings: HeatmapAiChartSettings,
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
            ? `Heatmap - ${params.settings.x} vs ${params.settings.y}`
            : 'Heatmap';

        const result = deps.createChart({
          artifactId,
          tableName,
          config: {
            chartType: 'heatmap',
            settings: params.settings,
          },
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
