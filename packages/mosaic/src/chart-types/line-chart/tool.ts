import {tool} from 'ai';
import {z} from 'zod';
import {LineChartSettings, AggregateFunction, TemporalInterval} from './schema';
import {BaseChartToolParameters} from '../tool-schemas';
import type {DashboardToolDeps} from '../base-types';
import {validateColumnExists} from '../tool-validation';
import {
  NUMERIC_COLUMN_TYPES,
  QUANTITATIVE_COLUMN_TYPES,
  TEMPORAL_COLUMN_TYPES,
} from '../../chart-builders/constants';
import {createOrUpdateChartPanel} from '../tool-helpers';

const AGGREGATE_FUNCTIONS = AggregateFunction.options;
const TEMPORAL_INTERVALS = TemporalInterval.options;

export const LineChartToolParameters = BaseChartToolParameters.extend({
  settings: LineChartSettings.required(),
});

export type LineChartToolParams = z.infer<typeof LineChartToolParameters>;

export function createLineChartAiTool(deps: DashboardToolDeps) {
  return tool({
    description: `Line chart: shows trends and changes over time or ordered continuous variable. Connects data points to show progression.

Use when: user asks about "trend", "over time", "changes in", "time series", "progression of", "track X over Y".
Example queries: "population growth over time", "temperature trend by month", "show land development over years", "elevation changes along route", "average precipitation by season".

Required:
- x: quantitative column (${QUANTITATIVE_COLUMN_TYPES.join(', ')})
- yFields: array of {field: string (numeric: ${NUMERIC_COLUMN_TYPES.join(', ')}), aggregate?: ${AGGREGATE_FUNCTIONS.join('|')}}

Optional: xInterval for temporal grouping (${TEMPORAL_INTERVALS.join(', ')}) when x is temporal (${TEMPORAL_COLUMN_TYPES.join(', ')}).
Multiple yFields create multi-line chart for comparing metrics.

To UPDATE an existing line chart: provide the panelId parameter. Otherwise creates new panel.

Do NOT use for: single point distributions (use histogram), categorical counts (use count-plot), two-variable correlations (use bubble-chart).`,
    inputSchema: LineChartToolParameters,
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
          QUANTITATIVE_COLUMN_TYPES,
          columns,
          'x',
        );

        for (const yField of params.settings.yFields) {
          validateColumnExists(
            yField.field,
            NUMERIC_COLUMN_TYPES,
            columns,
            'yFields',
          );
        }

        const result = createOrUpdateChartPanel(deps, {
          panelId: params.panelId,
          dashboardId: artifactId,
          tableName,
          title: params.settings.x
            ? `Line chart - ${params.settings.yFields?.map((f) => f.field).join(', ') || ''} over ${params.settings.x}`
            : 'Line chart',
          config: {
            chartType: 'line-chart',
            settings: params.settings,
          },
        });

        return {
          llmResult: {
            success: true,
            details: params.panelId
              ? `Updated line chart "${result.title}".`
              : `Created line chart "${result.title}".`,
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
