import {blockDocumentNodeToBlock} from '@sqlrooms/documents';
import {tool} from 'ai';
import {z} from 'zod';
import type {WorksheetAiAdapter} from './worksheet-types';
import type {ToolOutput} from '../tool-types';

const ListWorksheetBlocksToolInput = z.object({
  reasoning: z
    .string()
    .optional()
    .describe('Brief rationale for inspecting worksheet blocks.'),
});

type ListWorksheetBlocksToolInput = z.infer<
  typeof ListWorksheetBlocksToolInput
>;

type WorksheetBlockSummary = {
  blockId: string;
  type: string;
  title?: string;
  caption?: string;
  dashboardId?: string;
  blockType?: string;
  tableName?: string;
};

type ListWorksheetBlocksToolOutput = ToolOutput<{
  blocks?: WorksheetBlockSummary[];
}>;

export type CreateListWorksheetBlocksToolOptions = {
  /** Adapter for worksheet operations */
  worksheetAdapter: WorksheetAiAdapter;
  /** ID of the worksheet to inspect */
  worksheetId: string;
};

function summarizeBlock(
  block: ReturnType<typeof blockDocumentNodeToBlock>,
): WorksheetBlockSummary | undefined {
  if (!block) return undefined;

  if (block.type === 'statefulBlock') {
    return {
      blockId: block.id,
      type: block.type,
      blockType: block.blockType,
      ...(block.blockType === 'dashboard'
        ? {dashboardId: block.blockInstanceId}
        : {}),
      ...(block.title !== undefined ? {title: block.title} : {}),
      ...(block.caption !== undefined ? {caption: block.caption} : {}),
    };
  }

  if (block.type === 'chart') {
    return {
      blockId: block.id,
      type: block.type,
      tableName: block.tableName,
      ...(block.caption !== undefined ? {caption: block.caption} : {}),
    };
  }

  return {
    blockId: block.id,
    type: block.type,
    ...('text' in block ? {title: block.text} : {}),
    ...('caption' in block && block.caption !== undefined
      ? {caption: block.caption}
      : {}),
  };
}

/**
 * Creates a tool for listing worksheet blocks so agents can update existing
 * dashboard blocks instead of creating chat-only artifacts or duplicate blocks.
 */
export function createListWorksheetBlocksTool({
  worksheetAdapter,
  worksheetId,
}: CreateListWorksheetBlocksToolOptions) {
  return tool<ListWorksheetBlocksToolInput, ListWorksheetBlocksToolOutput>({
    description: `List existing blocks in the worksheet.

Use this before updating an existing worksheet dashboard or adding a map to a worksheet. Dashboard blocks include dashboardId; pass that dashboardId to embedded_dashboard_agent to add dashboard panels.`,
    inputSchema: ListWorksheetBlocksToolInput,
    execute: async () => {
      try {
        const blocks = worksheetAdapter.getBlocks(worksheetId) ?? [];
        return {
          success: true,
          blocks: blocks
            .map((node) => summarizeBlock(blockDocumentNodeToBlock(node)))
            .filter(
              (block): block is WorksheetBlockSummary => block !== undefined,
            ),
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
