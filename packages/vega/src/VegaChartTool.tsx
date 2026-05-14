import {tool} from 'ai';
import {z} from 'zod';
import {compile, TopLevelSpec} from 'vega-lite';
import {parse as vegaParse} from 'vega';
import type {DuckDbConnector} from '@sqlrooms/duckdb';

/**
 * Creates a SQL validator that checks queries by executing `SELECT 1 FROM (<query>) LIMIT 1`.
 * Returns an error message if the query fails or produces no rows.
 */
export function createSqlValidator(
  getConnector: () => DuckDbConnector | Promise<DuckDbConnector>,
): NonNullable<VegaChartToolOptions['validateSql']> {
  return async (sqlQuery, abortSignal) => {
    try {
      const connector = await getConnector();
      const result = await connector.query(
        `SELECT 1 FROM (${sqlQuery}) AS __validate LIMIT 1`,
        {signal: abortSignal},
      );
      if (result.numRows === 0) {
        return {valid: false, error: 'Query returned no rows'};
      }
      return {valid: true};
    } catch (e) {
      return {
        valid: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  };
}

/**
 * Zod schema for the VegaChart tool parameters
 */
export const VegaChartToolParameters = z.object({
  sqlQuery: z.string(),
  vegaLiteSpec: z.string(),
  reasoning: z.string(),
});

export type VegaChartToolParameters = z.infer<typeof VegaChartToolParameters>;

export type VegaChartToolOutput = {
  success: boolean;
  details: string;
  sqlQuery: string;
  vegaLiteSpec: TopLevelSpec | null;
  error?: string;
};

/**
 * Default description for the VegaChart tool
 */
export const DEFAULT_VEGA_CHART_DESCRIPTION = `A tool for creating VegaLite charts based on the schema of the SQL query result from the "query" tool.
In the response:
- omit the data from the vegaLiteSpec
- provide an sql query in sqlQuery instead.

Best practices for creating charts:
- try to use strptime to convert e.g. YYYYMMDD string format to a proper type (date, datetime, etc.)
- try to set the top-level width property to "container", so the chart will stretch to the full width of its parent container.
- for bar charts with few categories (<= 5), widen bars by reducing band padding on the x scale:
  - For 2-3 categories: set "encoding.x.scale.paddingInner" to 0.2 and "paddingOuter" to 0.1 for optimal bar width with clear separation
  - For 4-5 categories: set "encoding.x.scale.paddingInner" to 0.1 and "paddingOuter" to 0.05 for narrower spacing
  - Adjust to lower values (0.05/0.02 or 0/0) only if user specifically requests maximum bar width
- If the chart uses an encoding channel like color, shape, or size to represent a data field, then include a legend object in that channel's encoding (unless explicitly told not to).`;

/**
 * Options for creating a VegaChart tool
 */
export type VegaChartToolOptions = {
  /**
   * Custom description for the tool
   */
  description?: string;
  /**
   * Optional callback to validate the SQL query before rendering the chart.
   * When provided, the tool will execute this function to catch SQL errors
   * or empty results early, so the LLM can fix the query and retry.
   *
   * The function receives the SQL query string and an optional AbortSignal,
   * and should return `{valid: true}` or `{valid: false, error: string}`.
   *
   * For performance, implementations should use `LIMIT 1` or equivalent.
   */
  validateSql?: (
    sqlQuery: string,
    abortSignal?: AbortSignal,
  ) => Promise<{valid: true} | {valid: false; error: string}>;
};

/**
 * Creates a VegaLite chart visualization tool for AI assistants
 * @param options - Configuration options for the VegaChart tool
 * @param options.description - Custom description for the tool (defaults to a standard description)
 * @param options.editable - Whether editing is enabled (defaults to true)
 * @param options.editorMode - Which editors to show ('spec', 'sql', 'both', 'none')
 * @returns A tool that can be used with the AI assistant
 */
export function createVegaChartTool({
  description = DEFAULT_VEGA_CHART_DESCRIPTION,
  validateSql,
}: VegaChartToolOptions = {}) {
  return tool({
    description,
    inputSchema: VegaChartToolParameters,
    execute: async (params, options) => {
      const abortSignal = options?.abortSignal;
      const {sqlQuery, vegaLiteSpec} = params;
      try {
        if (abortSignal?.aborted) {
          throw new Error('Chart creation was aborted');
        }

        if (validateSql) {
          const validation = await validateSql(sqlQuery, abortSignal);
          if (!validation.valid) {
            return {
              success: false,
              details: `SQL query failed: ${validation.error}. Please fix the sqlQuery and call this tool again.`,
              sqlQuery,
              vegaLiteSpec: null,
            };
          }
        }

        const parsedVegaLiteSpec = JSON.parse(vegaLiteSpec) as TopLevelSpec;

        let vegaWarnings: string[] = [];
        try {
          const compiled = compile(parsedVegaLiteSpec);
          vegaWarnings = (compiled as any).warnings ?? [];
          vegaParse(compiled.spec);
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          return {
            success: false,
            details: `Invalid Vega-Lite spec: ${message}`,
            sqlQuery: '',
            vegaLiteSpec: null,
          };
        }

        return {
          success: true,
          details:
            vegaWarnings.length > 0
              ? `Chart created successfully with warnings:\n- ${vegaWarnings.join('\n- ')}`
              : 'Chart created successfully.',
          sqlQuery,
          vegaLiteSpec: parsedVegaLiteSpec,
        };
      } catch (error) {
        return {
          success: false,
          details: `Not a valid JSON object: ${error}`,
          error: error instanceof Error ? error.message : String(error),
          sqlQuery: '',
          vegaLiteSpec: null,
        };
      }
    },
    toModelOutput: ({output}) => ({
      type: 'text',
      value: JSON.stringify({
        success: output.success,
        details: output.details,
        ...(output.error ? {error: output.error} : {}),
      }),
    }),
  });
}
