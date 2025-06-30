import {z} from 'zod';
import {VegaChartToolResult} from './VegaChartToolResult';
import {AiSliceTool} from '@sqlrooms/ai';
import {extendedTool} from '@openassistant/utils';

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
} = {}): AiSliceTool {
  return extendedTool<
    VegaChartToolArgs,
    VegaChartToolLlmResult,
    VegaChartToolAdditionalData,
    VegaChartToolContext
  >({
    description,
    parameters: VegaChartToolParameters,
    execute: async ({sqlQuery, vegaLiteSpec}: VegaChartToolParameters) => {
      try {
        const parsedVegaLiteSpec = JSON.parse(vegaLiteSpec);
        // data object of the vegaLiteSpec and sqlQuery
        // it is not used yet, but we can use it to create a JSON editor for user to edit the vegaLiteSpec so that chart can be updated
        return {
          llmResult: {
            success: true,
            details: 'Chart created successfully.',
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
  });
}
