import {z} from 'zod';
import {VegaChartToolResult} from './VegaChartToolResult';
import {OpenAssistantTool} from '@openassistant/utils';
import {compile, TopLevelSpec} from 'vega-lite';
import {parse as vegaParse} from 'vega';

/**
 * Zod schema for the VegaChart tool parameters
 */
export const VegaChartToolParameters = z.object({
  sqlQuery: z.string(),
  vegaLiteSpec: z.string(),
  reasoning: z.string(),
});

export type VegaChartToolParameters = z.infer<typeof VegaChartToolParameters>;

export type VegaChartToolArgs = z.ZodObject<{
  sqlQuery: z.ZodString;
  vegaLiteSpec: z.ZodString;
  reasoning: z.ZodString;
}>;

export type VegaChartToolLlmResult = {
  success: boolean;
  details: string;
};

export type VegaChartToolAdditionalData = {
  sqlQuery: string;
  vegaLiteSpec: object;
};

export type VegaChartToolContext = unknown;

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
 * Creates a VegaLite chart visualization tool for AI assistants
 * @param options - Configuration options for the VegaChart tool
 * @param options.description - Custom description for the tool (defaults to a standard description)
 * @returns A tool that can be used with the AI assistant
 */
export function createVegaChartTool({
  description = DEFAULT_VEGA_CHART_DESCRIPTION,
}: {
  description?: string;
} = {}): OpenAssistantTool<
  typeof VegaChartToolParameters,
  VegaChartToolLlmResult,
  VegaChartToolAdditionalData,
  VegaChartToolContext
> {
  return {
    name: 'chart',
    description,
    parameters: VegaChartToolParameters,
    execute: async (
      params: VegaChartToolParameters,
      options?: {abortSignal?: AbortSignal},
    ) => {
      const abortSignal = options?.abortSignal;
      const {sqlQuery, vegaLiteSpec} = params;
      try {
        // Check if aborted before starting
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
          // vega-lite's compile() may expose warnings at runtime, but types don't include it
          vegaWarnings = (compiled as any).warnings ?? [];
          // This will throw if the compiled Vega spec is invalid
          vegaParse(compiled.spec);
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          return {
            llmResult: {
              success: false,
              details: `Invalid Vega-Lite spec: ${message}`,
            },
          };
        }

        // data object of the vegaLiteSpec and sqlQuery
        // it is not used yet, but we can use it to create a JSON editor for user to edit the vegaLiteSpec so that chart can be updated
        return {
          llmResult: {
            success: true,
            details:
              vegaWarnings.length > 0
                ? `Chart created successfully with warnings:\n- ${vegaWarnings.join('\n- ')}`
                : 'Chart created successfully.',
          },
          additionalData: {
            sqlQuery,
            vegaLiteSpec: parsedVegaLiteSpec,
          },
        };
      } catch (error) {
        return {
          llmResult: {
            success: false,
            details: `Not a valid JSON object: ${error}`,
          },
        };
      }
    },
    component: VegaChartToolResult,
  };
}
