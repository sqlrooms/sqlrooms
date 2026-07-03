import {tool} from 'ai';
import {z} from 'zod';
import type {BlockDocumentAiAdapter} from './BlockDocumentAi';
import {
  type BlockDocumentBlock,
  blockDocumentNodeToBlock,
} from './BlockDocumentSliceConfig';
import {createDefaultBlockDocumentBlockId} from './BlockDocumentEditor/BlockDocumentEditorContext';

const CopyBlockDocumentBlocksToolInput = z.object({
  reasoning: z
    .string()
    .optional()
    .describe('Brief rationale for copying these block document blocks.'),
  sourceBlockDocumentId: z
    .string()
    .optional()
    .describe(
      'Source block document ID. Defaults to the current block document. May match the target ID to duplicate blocks in place.',
    ),
  targetBlockDocumentId: z
    .string()
    .optional()
    .describe(
      'Target block document ID. Defaults to the current block document.',
    ),
  blockIds: z
    .array(z.string())
    .min(1)
    .describe(
      'IDs of the source blocks to copy, in the order they should be appended to the target block document.',
    ),
});

type CopyBlockDocumentBlocksToolInput = z.infer<
  typeof CopyBlockDocumentBlocksToolInput
>;

type BlockDocumentToolOutput<T> =
  | ({success: true} & T)
  | {success: false; errorMessage: string};

type CopiedBlockSummary = {
  sourceBlockId: string;
  blockId: string;
  type: BlockDocumentBlock['type'];
};

type CopyBlockDocumentBlocksToolOutput = BlockDocumentToolOutput<{
  sourceBlockDocumentId: string;
  targetBlockDocumentId: string;
  copiedBlocks: CopiedBlockSummary[];
  message: string;
}>;

/**
 * Options for creating a generic block-document block copy tool.
 */
export type CreateCopyBlockDocumentBlocksToolOptions = {
  /** Adapter for block document operations. */
  blockDocumentAdapter: BlockDocumentAiAdapter;
  /** Default block document used when source or target IDs are omitted. */
  blockDocumentId: string;
  /** Optional host-specific guidance appended to the tool description. */
  usageHint?: string;
};

function cloneBlockDocumentBlockForCopy(
  block: BlockDocumentBlock,
): BlockDocumentBlock {
  const copiedBlock = structuredClone(block) as BlockDocumentBlock;
  copiedBlock.id = createDefaultBlockDocumentBlockId();

  if (copiedBlock.type === 'statefulBlock') {
    copiedBlock.ownership =
      copiedBlock.ownership === 'external' ? 'external' : 'shared';
  }

  return copiedBlock;
}

/**
 * Creates a tool for copying selected blocks between block documents.
 *
 * The same source and target document ID is allowed and duplicates the selected
 * blocks at the end of that document. Stateful blocks are copied as shared
 * references so one stateful resource is not marked as owned by two blocks.
 */
export function createCopyBlockDocumentBlocksTool({
  blockDocumentAdapter,
  blockDocumentId,
  usageHint,
}: CreateCopyBlockDocumentBlocksToolOptions) {
  return tool<
    CopyBlockDocumentBlocksToolInput,
    CopyBlockDocumentBlocksToolOutput
  >({
    description: [
      'Copy selected blocks from one block document to another block document.',
      'Use this when the user asks to copy, duplicate, or recreate existing block-document content such as charts or text blocks.',
      'If sourceBlockDocumentId and targetBlockDocumentId are the same, the selected blocks are duplicated in the same block document.',
      'Copied stateful blocks become shared references to the same underlying stateful resource.',
      usageHint,
    ]
      .filter(Boolean)
      .join('\n\n'),
    inputSchema: CopyBlockDocumentBlocksToolInput,
    execute: async (params) => {
      try {
        const sourceBlockDocumentId =
          params.sourceBlockDocumentId ?? blockDocumentId;
        const targetBlockDocumentId =
          params.targetBlockDocumentId ?? blockDocumentId;

        blockDocumentAdapter.ensureBlockDocument(sourceBlockDocumentId);
        blockDocumentAdapter.ensureBlockDocument(targetBlockDocumentId);

        const sourceBlocks =
          blockDocumentAdapter.getBlocks(sourceBlockDocumentId) ?? [];
        const blocksById = new Map(
          sourceBlocks
            .map((node) => blockDocumentNodeToBlock(node))
            .filter((block): block is BlockDocumentBlock => block !== undefined)
            .map((block) => [block.id, block]),
        );

        const missingBlockIds = params.blockIds.filter(
          (blockId) => !blocksById.has(blockId),
        );
        if (missingBlockIds.length > 0) {
          return {
            success: false,
            errorMessage: `Could not find source block IDs: ${missingBlockIds.join(
              ', ',
            )}`,
          };
        }

        const copiedBlocks: CopiedBlockSummary[] = [];
        for (const sourceBlockId of params.blockIds) {
          const sourceBlock = blocksById.get(sourceBlockId);
          if (!sourceBlock) continue;

          const copiedBlock = cloneBlockDocumentBlockForCopy(sourceBlock);
          const blockId = await blockDocumentAdapter.addBlock(
            targetBlockDocumentId,
            copiedBlock,
          );
          copiedBlocks.push({
            sourceBlockId,
            blockId,
            type: copiedBlock.type,
          });
        }

        return {
          success: true,
          sourceBlockDocumentId,
          targetBlockDocumentId,
          copiedBlocks,
          message: `Copied ${copiedBlocks.length} block${
            copiedBlocks.length === 1 ? '' : 's'
          } to block document`,
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
