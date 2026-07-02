import {tool} from 'ai';
import {z} from 'zod';
import {
  type BlockDocumentAiAdapter,
  type BlockDocumentBlockSummary,
} from './BlockDocumentAi';
import {blockDocumentNodeToBlock} from './BlockDocumentSliceConfig';

const ListBlockDocumentBlocksToolInput = z.object({
  reasoning: z
    .string()
    .optional()
    .describe('Brief rationale for inspecting block document blocks.'),
});

type ListBlockDocumentBlocksToolInput = z.infer<
  typeof ListBlockDocumentBlocksToolInput
>;

type BlockDocumentToolOutput<T> =
  | ({success: true} & T)
  | {success: false; errorMessage: string};

type ListBlockDocumentBlocksToolOutput = BlockDocumentToolOutput<{
  blocks?: BlockDocumentBlockSummary[];
}>;

/**
 * Options for creating a generic block-document listing tool.
 */
export type CreateListBlockDocumentBlocksToolOptions = {
  /** Adapter for block document operations. */
  blockDocumentAdapter: BlockDocumentAiAdapter;
  /** ID of the block document to inspect. */
  blockDocumentId: string;
  /** Optional host-specific guidance appended to the tool description. */
  usageHint?: string;
};

function summarizeBlock(
  block: ReturnType<typeof blockDocumentNodeToBlock>,
  index: number,
): BlockDocumentBlockSummary | undefined {
  if (!block) return undefined;

  if (block.type === 'statefulBlock') {
    return {
      blockId: block.id,
      index,
      type: block.type,
      ...(block.title !== undefined ? {title: block.title} : {}),
      ...(block.caption !== undefined ? {caption: block.caption} : {}),
      statefulBlock: {
        blockType: block.blockType,
        ...(block.blockInstanceId !== undefined
          ? {blockInstanceId: block.blockInstanceId}
          : {}),
        ...(block.ownership !== undefined ? {ownership: block.ownership} : {}),
      },
    };
  }

  if (block.type === 'chart') {
    return {
      blockId: block.id,
      index,
      type: block.type,
      tableName: block.tableName,
      ...(block.caption !== undefined ? {caption: block.caption} : {}),
    };
  }

  return {
    blockId: block.id,
    index,
    type: block.type,
    ...('text' in block ? {title: block.text} : {}),
    ...('caption' in block && block.caption !== undefined
      ? {caption: block.caption}
      : {}),
  };
}

/**
 * Creates a tool for listing block-document blocks so agents can reuse or
 * update existing blocks instead of creating duplicates.
 */
export function createListBlockDocumentBlocksTool({
  blockDocumentAdapter,
  blockDocumentId,
  usageHint,
}: CreateListBlockDocumentBlocksToolOptions) {
  return tool<
    ListBlockDocumentBlocksToolInput,
    ListBlockDocumentBlocksToolOutput
  >({
    description: [
      'List existing blocks in the block document.',
      'Use this before updating an existing stateful block or adding related content.',
      usageHint,
    ]
      .filter(Boolean)
      .join('\n\n'),
    inputSchema: ListBlockDocumentBlocksToolInput,
    execute: async () => {
      try {
        const blocks = blockDocumentAdapter.getBlocks(blockDocumentId) ?? [];
        return {
          success: true,
          blocks: blocks
            .map((node, index) =>
              summarizeBlock(blockDocumentNodeToBlock(node), index),
            )
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
