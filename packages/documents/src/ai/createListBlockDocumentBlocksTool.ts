import {blockDocumentNodeToBlock} from '../index';
import {tool} from 'ai';
import {z} from 'zod';
import type {BlockDocumentAiAdapter} from './BlockDocumentAiAdapter';
import type {BlockDocumentBlockSummary} from './blockDocumentAiTypes';

const ListBlockDocumentBlocksToolInput = z.object({
  reasoning: z
    .string()
    .optional()
    .describe('Brief rationale for inspecting block document blocks.'),
});

type ListBlockDocumentBlocksToolInput = z.infer<
  typeof ListBlockDocumentBlocksToolInput
>;

type ListBlockDocumentBlocksToolOutput = {
  success: boolean;
  blocks?: BlockDocumentBlockSummary[];
  errorMessage?: string;
};

export type CreateListBlockDocumentBlocksToolOptions = {
  blockDocumentAdapter: BlockDocumentAiAdapter;
  blockDocumentId: string;
};

function summarizeBlock(
  block: ReturnType<typeof blockDocumentNodeToBlock>,
): BlockDocumentBlockSummary | undefined {
  if (!block) return undefined;

  if (block.type === 'statefulBlock') {
    return {
      blockId: block.id,
      type: block.type,
      statefulBlock: {
        blockType: block.blockType,
        blockInstanceId: block.blockInstanceId,
        ownership: 'owned',
      },
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
 * Creates a tool for listing block document blocks.
 * Provides generic summaries that work across different block types.
 */
export function createListBlockDocumentBlocksTool({
  blockDocumentAdapter,
  blockDocumentId,
}: CreateListBlockDocumentBlocksToolOptions) {
  return tool({
    description: `List existing blocks in the block document.

Use this to inspect current document structure before modifying or adding blocks. Stateful blocks include blockType and blockInstanceId for further operations.`,
    inputSchema: ListBlockDocumentBlocksToolInput,
    execute: async (): Promise<ListBlockDocumentBlocksToolOutput> => {
      try {
        const blocks = blockDocumentAdapter.getBlocks(blockDocumentId) ?? [];
        return {
          success: true,
          blocks: blocks
            .map((node) => summarizeBlock(blockDocumentNodeToBlock(node)))
            .filter(
              (block): block is BlockDocumentBlockSummary =>
                block !== undefined,
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
