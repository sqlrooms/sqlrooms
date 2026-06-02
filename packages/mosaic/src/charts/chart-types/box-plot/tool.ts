import {tool} from 'ai';
import {z} from 'zod';
import {BoxPlotChartSettings} from './schema';
import {BaseChartToolParameters} from '../../../ai/tool-schemas';
import {type DashboardToolDeps} from '../base-types';
import {validateColumnExists} from '../../../ai/tool-validation';
import {
  NUMERIC_COLUMN_TYPES,
  CATEGORICAL_COLUMN_TYPES,
} from '../../../chart-builders/constants';
import {createOrUpdateChartPanel} from '../../../ai/tool-helpers';

export const BoxPlotToolParameters = BaseChartToolParameters.extend({
  settings: BoxPlotChartSettings.required(),
});

export type BoxPlotToolParams = z.infer<typeof BoxPlotToolParameters>;

export function createBoxPlotAiTool(deps: DashboardToolDeps) {
  return tool({
    description: `Box plot: compares distributions of numeric values across categories. Shows median, quartiles (25th, 75th percentiles), and outliers per group.

Use when: user asks to "compare [numeric] across/by [category]", "distribution by group", "show outliers by", "compare ranges".
Example queries: "compare population by administrative region", "show elevation distribution by terrain type", "parcel area range by zone", "compare building heights across districts", "temperature by climate zone".

Required:
- x: categorical/grouping column (${CATEGORICAL_COLUMN_TYPES.join(', ')}) - e.g., region, terrain type, zone classification
- y: numeric (${NUMERIC_COLUMN_TYPES.join(', ')})

NOTE: Box plots aggregate data by computing quartiles and outliers per group, so they handle large datasets efficiently (no data point limit).

To UPDATE an existing box plot: provide the panelId parameter. Otherwise creates new panel.

Best for: comparing distributions between groups, finding outliers per category, seeing spread and variance differences.

Do NOT use for: single distribution (use histogram), time trends (use line-chart), simple counts (use count-plot).`,
    inputSchema: BoxPlotToolParameters,
    execute: async (params, context) => {
      try {
        const artifactId = deps.resolveArtifact(
          params.artifactId,
          params.createArtifactIfMissing,
          context,
        );
        const {tableName, columns} = deps.resolveTable(
          artifactId,
          params.tableName,
        );

        // Validate settings
        validateColumnExists(
          params.settings.x,
          CATEGORICAL_COLUMN_TYPES,
          columns,
          'x',
        );
        validateColumnExists(
          params.settings.y,
          NUMERIC_COLUMN_TYPES,
          columns,
          'y',
        );

        const result = createOrUpdateChartPanel(deps, {
          panelId: params.panelId,
          dashboardId: artifactId,
          tableName,
          title: `Box plot - ${params.settings.y} by ${params.settings.x}`,
          config: {
            chartType: 'box-plot',
            settings: params.settings,
          },
        });

        return {
          llmResult: {
            success: true,
            details: params.panelId
              ? `Updated box plot "${result.title}".`
              : `Created box plot "${result.title}".`,
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
