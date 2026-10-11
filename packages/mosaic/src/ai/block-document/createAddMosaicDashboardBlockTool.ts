import type {
  BlockDocumentAiAdapter,
  BlockDocumentStatefulBlockBlock,
} from '@sqlrooms/documents';
import {tool} from 'ai';
import {z} from 'zod';
import type {ToolOutput} from '../tool-types';

const AddMosaicDashboardBlockToolInput = z.object({
  reasoning: z.string().describe('Brief rationale for dashboard block choice.'),
  dashboardTitle: z.string().describe('The title of the dashboard.'),
  tableName: z.string().describe('The name of the table/dataset to analyze.'),
  intent: z
    .string()
    .optional()
    .describe('Optional natural-language objective for this dashboard block.'),
});

type AddMosaicDashboardBlockToolInput = z.infer<
  typeof AddMosaicDashboardBlockToolInput
>;

type AddMosaicDashboardBlockToolOutput = ToolOutput<{
  dashboardId?: string;
  blockId?: string;
  message?: string;
}>;

/**
 * Options for creating a Mosaic dashboard block-document tool.
 */
export type CreateAddMosaicDashboardBlockToolOptions = {
  /** Adapter for block document operations. */
  blockDocumentAdapter: BlockDocumentAiAdapter;
  /** ID of the block document where dashboard blocks will be added. */
  blockDocumentId: string;
  /** Host callback that performs the full durable block creation. */
  addDashboardBlock?: (params: {
    title: string;
    tableName: string;
    intent?: string;
  }) => Promise<{dashboardId: string; blockId: string}>;
  /** Host callback that creates Mosaic dashboard state and its document block. */
  createDashboardBlock: (params: {
    title: string;
    tableName: string;
    intent?: string;
  }) =>
    | {dashboardId: string; block: BlockDocumentStatefulBlockBlock}
    | Promise<{dashboardId: string; block: BlockDocumentStatefulBlockBlock}>;
};

/**
 * Creates a tool for adding an empty Mosaic dashboard block to a block document.
 */
export function createAddMosaicDashboardBlockTool({
  blockDocumentAdapter,
  blockDocumentId,
  addDashboardBlock,
  createDashboardBlock,
}: CreateAddMosaicDashboardBlockToolOptions) {
  return tool<
    AddMosaicDashboardBlockToolInput,
    AddMosaicDashboardBlockToolOutput
  >({
    description: `Create an EMPTY Mosaic dashboard block container in the block document.

This tool ONLY creates the container structure. To populate it with charts and panels, use other tools afterward.`,
    inputSchema: AddMosaicDashboardBlockToolInput,
    execute: async ({dashboardTitle, tableName, intent}) => {
      try {
        if (addDashboardBlock) {
          const result = await addDashboardBlock({
            title: dashboardTitle,
            tableName,
            intent,
          });
          return {
            success: true,
            dashboardId: result.dashboardId,
            blockId: result.blockId,
            message: 'Added Mosaic dashboard block to block document',
          };
        }

        blockDocumentAdapter.ensureBlockDocument(blockDocumentId);
        const {dashboardId, block} = await createDashboardBlock({
          title: dashboardTitle,
          tableName,
          intent,
        });
        const blockId = await blockDocumentAdapter.addBlock(
          blockDocumentId,
          block,
        );

        return {
          success: true,
          dashboardId,
          blockId,
          message: 'Added Mosaic dashboard block to block document',
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
