import {tool} from 'ai';
import {z} from 'zod';
import {BoxPlotChartConfig, BoxPlotChartSettings} from './schema';
import {BaseChartToolParameters} from '../../../ai/tool-schemas';
import {
  NUMERIC_COLUMN_TYPES,
  CATEGORICAL_COLUMN_TYPES,
} from '../../../column-types-utils';
import {ChartToolDeps, ChartToolOutput} from '../tool-types';
import {validateBoxPlotSettings} from './validation';

export const BoxPlotToolParameters = BaseChartToolParameters.extend({
  settings: BoxPlotChartSettings.required(),
});

export type BoxPlotToolParams = z.infer<typeof BoxPlotToolParameters>;

export function createBoxPlotAiTool(deps: ChartToolDeps) {
  return tool<BoxPlotToolParams, ChartToolOutput<BoxPlotChartConfig>>({
    description: `Box plot: compares distributions of numeric values across categories. Shows median, quartiles (25th, 75th percentiles), and outliers per group.

Use when: user asks to "compare [numeric] across/by [category]", "distribution by group", "show outliers by", "compare ranges".
Example queries: "compare population by administrative region", "show elevation distribution by terrain type", "parcel area range by zone", "compare building heights across districts", "temperature by climate zone".

Required:
- x: categorical/grouping column (${CATEGORICAL_COLUMN_TYPES.join(', ')}) - e.g., region, terrain type, zone classification
- y: numeric (${NUMERIC_COLUMN_TYPES.join(', ')})

NOTE: Box plots aggregate data by computing quartiles and outliers per group, so they handle large datasets efficiently (no data point limit).

Best for: comparing distributions between groups, finding outliers per category, seeing spread and variance differences.

Do NOT use for: single distribution (use histogram), time trends (use line-chart), simple counts (use count-plot).`,
    inputSchema: BoxPlotToolParameters,
    execute: async (params) => {
      try {
        const dataTable = deps.resolveTable(params.tableName);

        validateBoxPlotSettings({
          dataTable,
          settings: params.settings,
        });

        return {
          llmResult: {
            success: true,
            details: `Generated box plot configuration.`,
            data: {
              chartType: 'box-plot',
              settings: params.settings,
            },
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
