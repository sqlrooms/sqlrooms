import {tool} from 'ai';
import {z} from 'zod';
import type {BlockDocumentAiAdapter} from '@sqlrooms/documents';
import type {BlockDocumentStatefulBlockBlock} from '@sqlrooms/documents';

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

type AddDashboardBlockToolOutput = {
  success: boolean;
  dashboardId?: string;
  message?: string;
  errorMessage?: string;
};

/**
 * Options for creating the add Mosaic dashboard block tool.
 */
export type CreateAddMosaicDashboardBlockToolOptions = {
  blockDocumentAdapter: BlockDocumentAiAdapter;
  blockDocumentId: string;
  /**
   * Callback to create dashboard state and block.
   * Implemented by the host (e.g., CLI app) to manage Mosaic dashboard state.
   */
  createDashboardBlock: (params: {
    title: string;
    tableName: string;
    intent?: string;
  }) => {dashboardId: string; block: BlockDocumentStatefulBlockBlock};
};

/**
 * Creates a tool for adding Mosaic dashboard blocks to a block document.
 */
export function createAddMosaicDashboardBlockTool({
  blockDocumentAdapter,
  blockDocumentId,
  createDashboardBlock,
}: CreateAddMosaicDashboardBlockToolOptions) {
  return tool<AddDashboardBlockToolInput, AddDashboardBlockToolOutput>({
    description: `Create an EMPTY dashboard block container in the block document.

This tool ONLY creates the container structure. To populate it with charts and panels, use other tools afterward.

Use this when you need to create a dashboard block.`,
    inputSchema: AddDashboardBlockToolInput,
    execute: async ({dashboardTitle, tableName, intent}) => {
      try {
        const {dashboardId, block} = createDashboardBlock({
          title: dashboardTitle,
          tableName,
          intent,
        });

        blockDocumentAdapter.addBlock(blockDocumentId, block);

        return {
          success: true,
          dashboardId: dashboardId,
          message: `Added dashboard block to block document`,
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
