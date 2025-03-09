import {z} from 'zod';
import {VegaChartToolResult} from './VegaChartToolResult';
import {AiSliceTool} from '@sqlrooms/ai';

/**
 * Zod schema for the VegaChart tool parameters
 */
export const VegaChartToolParameters = z.object({
  sqlQuery: z.string(),
  vegaLiteSpec: z.string(),
  reasoning: z.string(),
});

export type VegaChartToolParameters = z.infer<typeof VegaChartToolParameters>;

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
  return {
    description,
    parameters: VegaChartToolParameters,
    execute: async ({sqlQuery, vegaLiteSpec}: VegaChartToolParameters) => {
      // data object of the vegaLiteSpec and sqlQuery
      // it is not used yet, but we can use it to create a JSON editor for user to edit the vegaLiteSpec so that chart can be updated
      return {
        llmResult: {
          success: true,
          details: 'Chart created successfully.',
        },
        additionalData: {
          sqlQuery,
          vegaLiteSpec,
        },
      };
    },
    component: VegaChartToolResult,
  };
}
