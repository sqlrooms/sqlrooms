import {tool} from 'ai';
import {z} from 'zod';

import type {WorksheetAiAdapter} from './worksheet-types';
import {ToolOutput} from '../tool-types';

const AddDashboardBlockParameters = z.object({
  dashboardTitle: z.string().describe('The title of the dashboard'),
  tableName: z.string().describe('The name of the table/dataset to analyze.'),
  intent: z
    .string()
    .optional()
    .describe('Optional natural-language objective for this dashboard block.'),
});

type AddDashboardBlockParameters = z.infer<typeof AddDashboardBlockParameters>;

const AddDashboardBlockToolInput = z.object({
  reasoning: z.string().describe('Brief rationale for dashboard block choice.'),
  ...AddDashboardBlockParameters.shape,
});

type AddDashboardBlockToolInput = z.infer<typeof AddDashboardBlockToolInput>;

type AddDashboardBlockToolOutput = ToolOutput<{
  dashboardId?: string;
  message?: string;
}>;

/**
 * Options for creating the add dashboard block tool.
 * Provides worksheet context for adding dashboard blocks to a specific worksheet.
 */
export type CreateAddDashboardBlockToolOptions = {
  /** Adapter for worksheet operations */
  worksheetAdapter: WorksheetAiAdapter;
  /** ID of the worksheet where dashboard blocks will be added */
  worksheetId: string;
};

/**
 * Creates a tool for adding dashboard blocks to a worksheet.
 */
export function createAddDashboardBlockTool({
  worksheetAdapter,
  worksheetId,
}: CreateAddDashboardBlockToolOptions) {
  return tool<AddDashboardBlockToolInput, AddDashboardBlockToolOutput>({
    description: `Create an EMPTY dashboard block container in the worksheet.

This tool ONLY creates the container structure. To populate it with charts and panels, use other tools afterward.

Use this when you need to create a dashboard block in a worksheet.`,
    inputSchema: AddDashboardBlockToolInput,
    execute: async ({dashboardTitle, tableName, intent}) => {
      try {
        const {dashboardId} = worksheetAdapter.addDashboardBlock(
          worksheetId,
          dashboardTitle,
          tableName,
          intent,
        );

        return {
          success: true,
          dashboardId: dashboardId,
          message: `Added dashboard block to worksheet`,
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
