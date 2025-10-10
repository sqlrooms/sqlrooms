import {AiSliceTool} from '@sqlrooms/ai-core';
import {z} from 'zod';
import {ReportToolResult} from './reportToolResult';

export function createReportTool() {
  return {
    description: `Generate a downloadable HTML summary report from the chat history.
- In the summary parameter, always include placeholders for important tool outputs using the format [[TOOL:<toolCallId>]].
  - A tool output is "important" if it directly supports key findings or contains query and chart results referenced in the narrative.
  - If the "toolCallId" parameter is provided, you must insert a placeholder for each id in-context near where it is discussed.
  - If you cannot confidently place one, append an "Appendix" section at the end listing one [[TOOL:<id>]] per missing id in order.
The app will replace these placeholders with the rendered DOM of the corresponding tool results when printing or saving the HTML.
IMPORTANT: Return empty text as your response to the user. The placeholders should ONLY be included in the summary parameter, never in your response to the user.`,
    parameters: z
      .object({
        format: z
          .enum(['html'])
          .default('html')
          .describe(
            'Fixed to html to render DOM elements in the saved report.',
          ),
        summary: z
          .string()
          .describe(
            'The final analysis summary to include at the top of the report (markdown or HTML content).',
          ),
        filename: z
          .string()
          .max(100)
          .describe(
            'The base filename (≤100 chars) for the report without extension.',
          ),
        toolCallIds: z
          .array(z.string().min(1))
          .optional()
          .describe(
            'Optional list of executed tool invocation IDs that should appear in the report as visuals. Provide up to ~20.',
          ),
      })
      .describe('Inputs to create the downloadable report.'),
    execute: async (options: {
      summary: string;
      format: 'html';
      filename: string;
      toolCallIds?: string[];
    }) => {
      const {summary, format, filename, toolCallIds} = options;

      return {
        llmResult: {
          success: true,
          details: `Report ready: ${filename}.${format}. Use the download button to save it locally.`,
        },
        additionalData: {
          filename,
          format,
          summary,
          toolCallIds: toolCallIds ?? [],
        },
      };
    },
    context: {},
    component: ReportToolResult,
  } as AiSliceTool;
}
