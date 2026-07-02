import {tool} from 'ai';
import {z} from 'zod';
import type {BlockDocumentAiAdapter} from './BlockDocumentAi';

const MoveBlockDocumentBlockToolInput = z.object({
  reasoning: z
    .string()
    .optional()
    .describe('Brief rationale for moving this block.'),
  blockId: z.string().describe('ID of the top-level block to move.'),
  toIndex: z
    .number()
    .int()
    .describe('Zero-based destination index among top-level blocks.'),
});

type MoveBlockDocumentBlockToolInput = z.infer<
  typeof MoveBlockDocumentBlockToolInput
>;

type BlockDocumentToolOutput<T> =
  | ({success: true} & T)
  | {success: false; errorMessage: string};

type MoveBlockDocumentBlockToolOutput = BlockDocumentToolOutput<{
  blockId?: string;
  toIndex?: number;
  message?: string;
}>;

/**
 * Options for creating a generic block-document move tool.
 */
export type CreateMoveBlockDocumentBlockToolOptions = {
  /** Adapter for block document operations. */
  blockDocumentAdapter: BlockDocumentAiAdapter;
  /** ID of the block document where blocks will be reordered. */
  blockDocumentId: string;
};

/**
 * Creates a tool for reordering one top-level block in a block document.
 */
export function createMoveBlockDocumentBlockTool({
  blockDocumentAdapter,
  blockDocumentId,
}: CreateMoveBlockDocumentBlockToolOptions) {
  return tool<
    MoveBlockDocumentBlockToolInput,
    MoveBlockDocumentBlockToolOutput
  >({
    description: `Move a top-level block in the block document to a new index.
Use this after listing blocks when the user asks to reorder worksheet content, such as moving a paragraph to the top.`,
    inputSchema: MoveBlockDocumentBlockToolInput,
    execute: async ({blockId, toIndex}) => {
      try {
        blockDocumentAdapter.ensureBlockDocument(blockDocumentId);
        const moved = await blockDocumentAdapter.moveBlock(
          blockDocumentId,
          blockId,
          toIndex,
        );

        if (!moved) {
          return {
            success: false,
            errorMessage: `Block "${blockId}" was not found.`,
          };
        }

        return {
          success: true,
          blockId,
          toIndex,
          message: `Moved block ${blockId} to index ${toIndex}`,
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
