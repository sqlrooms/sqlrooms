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
- provide an sql query in sqlQuery instead.`;

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
    execute: async (params: VegaChartToolParameters, options?: { abortSignal?: AbortSignal }) => {
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
