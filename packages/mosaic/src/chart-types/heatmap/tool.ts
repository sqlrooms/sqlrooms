import {tool} from 'ai';
import {z} from 'zod';
import {HeatmapChartSettings} from './schema';
import {BaseChartToolParameters} from '../tool-schemas';
import {type ChartToolDeps} from '../base-types';
import {validateColumnExists} from '../tool-validation';
import {NUMERIC_COLUMN_TYPES} from '../../chart-builders/constants';

export const HeatmapToolParameters = BaseChartToolParameters.extend({
  settings: HeatmapChartSettings.required(),
});

export type HeatmapToolParams = z.infer<typeof HeatmapToolParameters>;

export function createHeatmapAiTool(deps: ChartToolDeps) {
  return tool({
    description: `Heatmap: visualizes density or aggregated values across two dimensions using color intensity in a grid. Each cell color shows count/sum at that x,y position.

Use when: user asks about "heatmap", "density by X and Y", "activity by [category] and [category]", "intensity", "patterns across two dimensions".
Example queries: "heatmap of population density by latitude and longitude", "temperature by elevation and month", "show building density by coordinates", "land use intensity by region and type", "feature distribution by grid cell".

Required: x and y should be numeric (${NUMERIC_COLUMN_TYPES.join(', ')}) for creating the grid.

Best for: large datasets with overlapping points, finding patterns/hotspots in 2D space, temporal patterns (hour×day), spatial density visualization.

Do NOT use for: individual point plots (use bubble-chart), single variable distribution (use histogram), time trends (use line-chart).`,
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
