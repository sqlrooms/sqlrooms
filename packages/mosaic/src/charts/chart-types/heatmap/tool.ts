import {tool} from 'ai';
import {z} from 'zod';
import {HeatmapChartConfig, HeatmapChartSettings} from './schema';
import {BaseChartToolInput} from '../../../ai/tool-schemas';
import {NUMERIC_COLUMN_TYPES} from '../../../column-types-utils';
import {ChartToolParams, ChartToolOutput} from '../tool-types';
import {validateHeatmapSettings} from './validation';
import {ensureTable} from '../../../ai/tool-helpers';

export const HeatmapToolInput = BaseChartToolInput.extend({
  settings: HeatmapChartSettings.required(),
});

export type HeatmapToolInput = z.infer<typeof HeatmapToolInput>;

export function createHeatmapAiTool({
  databaseAdapter,
  addChart,
  maxDataPoints,
}: ChartToolParams) {
  return tool<HeatmapToolInput, ChartToolOutput<HeatmapChartConfig>>({
    description: `Heatmap: visualizes density or aggregated values across two dimensions using color intensity in a grid. Each cell color shows count/sum at that x,y position.

Use when: user asks about "heatmap", "density by X and Y", "activity by [category] and [category]", "intensity", "patterns across two dimensions".
Example queries: "heatmap of population density by latitude and longitude", "temperature by elevation and month", "show building density by coordinates", "land use intensity by region and type", "feature distribution by grid cell".

Required: x and y should be numeric (${NUMERIC_COLUMN_TYPES.join(', ')}) for creating the grid.

NOTE: Heatmaps aggregate data into grid cells and compute density/counts, so they handle large datasets efficiently (no data point limit). Heatmaps are a good alternative when scatter charts would exceed ${maxDataPoints.toLocaleString()} rows.

Best for: large datasets with overlapping points, finding patterns/hotspots in 2D space, temporal patterns (hour×day), spatial density visualization.

Do NOT use for: individual point plots (use scatter-plot), single variable distribution (use histogram), time trends (use line-chart).`,
    inputSchema: HeatmapToolInput,
    execute: async ({tableName, title, settings}) => {
      try {
        const dataTable = ensureTable(databaseAdapter, tableName);

        validateHeatmapSettings({
          dataTable,
          settings,
        });

        const chartConfig: HeatmapChartConfig = {
          chartType: 'heatmap' as const,
          settings,
        };

        addChart({
          tableName,
          title,
          config: chartConfig,
        });

        return {
          success: true,
          details: `Generated heatmap configuration.`,
          data: chartConfig,
        };
      } catch (error) {
        return {
          success: false,
          errorMessage: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });
}
