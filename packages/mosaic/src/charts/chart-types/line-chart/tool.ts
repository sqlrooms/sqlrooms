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
  settings: LineChartSettings.required({x: true}),
});

export type LineChartToolInput = z.infer<typeof LineChartToolInput>;

/**
 * Create an AI tool that validates count/numeric settings before invoking the
 * host's chart callback. Existing panel targets are forwarded for in-place
 * editing; validation or host failures are returned as unsuccessful results.
 */
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

Metric decision:
- For event counts/frequency over time on raw observations, set metric: "count" and omit yFields. This counts ALL rows using COUNT(*), including rows with null identifiers. Example: {x: "DateTime", xInterval: "month", metric: "count"}.
- Count charts retain the ${maxDataPoints.toLocaleString()} result-point limit. An interval groups source rows but may still yield too many points; use a coarser temporal interval or fewer distinct X values if needed.
- For numeric measures or already summarized counts, use metric: "aggregate" (the default) with yFields: array of {field: string (numeric: ${NUMERIC_COLUMN_TYPES.join(', ')}), aggregate?: ${AGGREGATE_FUNCTIONS.join('|')}}.
- Never sum an event ID or other identifier to represent a count. Do not put aggregate: "count" in yFields; row counts use metric: "count" instead.

Optional: xInterval for temporal grouping (${TEMPORAL_INTERVALS.join(', ')}) when x is temporal (${TEMPORAL_COLUMN_TYPES.join(', ')}).
Multiple yFields create multi-line chart for comparing metrics.

NOTE: Line charts with aggregation (xInterval or aggregate functions) handle large datasets well. Without aggregation, line charts plot individual points and should not be used for tables with more than ${maxDataPoints.toLocaleString()} rows - use aggregated visualizations instead.

Do NOT use for: single point distributions (use histogram), categorical counts (use count-plot), two-variable correlations (use scatter-plot).`,
    inputSchema: LineChartToolInput,
    execute: async ({tableName, title, settings, panelId}) => {
      try {
        const dataTable = ensureTable(databaseAdapter, tableName);
        const normalizedSettings = LineChartSettings.parse(settings);

        const validatedSettings = validateLineChartSettings({
          dataTable,
          settings: normalizedSettings,
        });
        const shouldLimitResults =
          validatedSettings.metric === 'count' || !validatedSettings.xInterval;

        const chartConfig: LineChartConfig = {
          chartType: 'line-chart' as const,
          settings: normalizedSettings,
          ...(shouldLimitResults ? {dataPolicy: {maxRows: maxDataPoints}} : {}),
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
