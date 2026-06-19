import {tool} from 'ai';
import {z} from 'zod';

import type {WorksheetAiAdapter} from './worksheet-types';
import {ToolOutput} from '../tool-types';

const AddDashboardBlockParameters = z.object({
  dashboardTitle: z.string().describe('The title of the dashboard'),
  tableName: z.string().describe('The name of the table/dataset to analyze.'),
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

export type CreateAddDashboardBlockToolOptions = {
  worksheetAdapter: WorksheetAiAdapter;
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

This tool ONLY creates the container structure. To populate it with charts and panels, use the dashboard_agent tool afterward.

WORKFLOW:
1. Call add_dashboard_block to create the empty container (returns dashboardId)
2. Call dashboard_agent with the dashboardId to fill it with charts and panels

Use this when you need to create a dashboard block in a worksheet as part of a two-step process.`,
    inputSchema: AddDashboardBlockToolInput,
    execute: async ({dashboardTitle, tableName}) => {
      try {
        const {dashboardId} = worksheetAdapter.addDashboardBlock(
          worksheetId,
          dashboardTitle,
          tableName,
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
