import {tool} from 'ai';
import {z} from 'zod';
import {LineChartConfig, LineChartSettings} from './schema';
import {AggregateFunction, TemporalInterval} from '../../../schemas';
import {BaseChartToolInput} from '../../../ai/tool-schemas';
import {
  NUMERIC_COLUMN_TYPES,
  QUANTITATIVE_COLUMN_TYPES,
  TEMPORAL_COLUMN_TYPES,
} from '../../../column-types-utils';
import {ChartToolParams, ChartToolOutput} from '../tool-types';
import {validateLineChartSettings} from './validation';
import {ensureTable} from '../../../ai/tool-helpers';

const AGGREGATE_FUNCTIONS = AggregateFunction.options;
const TEMPORAL_INTERVALS = TemporalInterval.options;

export const LineChartToolInput = BaseChartToolInput.extend({
  settings: LineChartSettings.required(),
});

export type LineChartToolInput = z.infer<typeof LineChartToolInput>;

export function createLineChartAiTool({
  databaseAdapter,
  addChart,
  maxDataPoints,
}: ChartToolParams) {
  return tool<LineChartToolInput, ChartToolOutput<LineChartConfig>>({
    description: `Line chart: shows trends and changes over time or ordered continuous variable. Connects data points to show progression.

Use when: user asks about "trend", "over time", "changes in", "time series", "progression of", "track X over Y".
Example queries: "population growth over time", "temperature trend by month", "show land development over years", "elevation changes along route", "average precipitation by season".

Required:
- x: quantitative column (${QUANTITATIVE_COLUMN_TYPES.join(', ')})
- yFields: array of {field: string (numeric: ${NUMERIC_COLUMN_TYPES.join(', ')}), aggregate?: ${AGGREGATE_FUNCTIONS.join('|')}}

Optional: xInterval for temporal grouping (${TEMPORAL_INTERVALS.join(', ')}) when x is temporal (${TEMPORAL_COLUMN_TYPES.join(', ')}).
Multiple yFields create multi-line chart for comparing metrics.

NOTE: Line charts with aggregation (xInterval or aggregate functions) handle large datasets well. Without aggregation, line charts plot individual points and should not be used for tables with more than ${maxDataPoints.toLocaleString()} rows - use aggregated visualizations instead.

Do NOT use for: single point distributions (use histogram), categorical counts (use count-plot), two-variable correlations (use scatter-plot).`,
    inputSchema: LineChartToolInput,
    execute: async ({tableName, title, settings, panelId}) => {
      try {
        const dataTable = ensureTable(databaseAdapter, tableName);

        validateLineChartSettings({
          dataTable,
          settings,
        });

        const chartConfig: LineChartConfig = {
          chartType: 'line-chart' as const,
          settings,
        };

        await addChart({
          tableName,
          panelId,
          title,
          config: chartConfig,
        });

        return {
          success: true,
          details: `Generated line chart configuration.`,
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
