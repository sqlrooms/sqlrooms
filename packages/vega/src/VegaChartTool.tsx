import {tool, type Tool} from 'ai';
import {z} from 'zod';
import {compile, TopLevelSpec} from 'vega-lite';
import {parse as vegaParse} from 'vega';
import type {DuckDbConnector} from '@sqlrooms/duckdb';

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
  rowCount?: number;
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
   * Optional function that returns a DuckDbConnector.
   * When provided, the tool will pre-validate the SQL query during execution
   * and return an error if the query fails or returns zero rows, giving the
   * LLM a chance to correct the query before rendering an empty chart.
   */
  getConnector?: () => Promise<DuckDbConnector>;
};

/**
 * Creates a VegaLite chart visualization tool for AI assistants
 * @param options - Configuration options for the VegaChart tool
 * @param options.description - Custom description for the tool (defaults to a standard description)
 * @param options.getConnector - Optional async function returning a DuckDbConnector for SQL pre-validation
 * @returns A tool that can be used with the AI assistant
 */
export function createVegaChartTool({
  description = DEFAULT_VEGA_CHART_DESCRIPTION,
  getConnector,
}: VegaChartToolOptions = {}): Tool<any, any> {
  return tool<VegaChartToolParameters, VegaChartToolOutput>({
    description,
    inputSchema: VegaChartToolParameters,
    execute: async (params, options) => {
      const abortSignal = options?.abortSignal;
      const {sqlQuery, vegaLiteSpec} = params;
      try {
        if (abortSignal?.aborted) {
          throw new Error('Chart creation was aborted');
        }

        const parsedVegaLiteSpec = JSON.parse(vegaLiteSpec) as TopLevelSpec;

        // Validate/spec-check by compiling to Vega and attempting to parse it.
        // - compile() can throw on invalid Vega-Lite specs
        // - vegaParse() will throw if the compiled Vega spec is invalid
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

        // Pre-validate the SQL query if a connector is available.
        // Uses COUNT(*) wrapper so only a single integer is transferred,
        // avoiding the cost of materializing the full result set twice
        // (once here and once in the chart renderer).
        let rowCount: number | undefined;
        if (getConnector && sqlQuery) {
          try {
            const connector = await getConnector();
            const countResult = await connector.query(
              `SELECT COUNT(*) AS cnt FROM (${sqlQuery})`,
              {signal: abortSignal},
            );
            rowCount = Number(countResult.getChildAt(0)?.get(0) ?? 0);
            if (rowCount === 0) {
              return {
                success: false,
                details:
                  'The SQL query returned 0 rows. The chart would be empty. ' +
                  'Please revise the query to return data — check filters, ' +
                  'date ranges, column names, and table contents.',
                error: 'SQL query returned empty result set',
                sqlQuery,
                vegaLiteSpec: null,
                rowCount: 0,
              };
            }
          } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            return {
              success: false,
              details: `SQL query failed: ${message}. Please fix the query and try again.`,
              error: message,
              sqlQuery,
              vegaLiteSpec: null,
            };
          }
        }

        return {
          success: true,
          details:
            vegaWarnings.length > 0
              ? `Chart created successfully with warnings:\n- ${vegaWarnings.join('\n- ')}`
              : 'Chart created successfully.',
          sqlQuery,
          vegaLiteSpec: parsedVegaLiteSpec,
          rowCount,
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
    toModelOutput: (output) => ({
      type: 'text',
      value: JSON.stringify({
        success: output.success,
        details: output.details,
        ...(output.error ? {error: output.error} : {}),
        ...(output.rowCount !== undefined ? {rowCount: output.rowCount} : {}),
      }),
    }),
  });
}
