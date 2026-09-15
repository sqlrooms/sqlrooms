import {tool} from 'ai';
import {summarizeBlockDocumentBlock} from './summarizeBlockDocumentBlock';
import {z} from 'zod';
import {
  type BlockDocumentAiAdapter,
  type BlockDocumentBlockSummary,
} from './BlockDocumentAi';
import {
  blockDocumentNodeToBlock,
  type BlockDocumentBlock,
} from './BlockDocumentSliceConfig';

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
  blockDocumentId: string;
  documentExists: boolean;
  blocks?: BlockDocumentBlockSummary[];
}>;

export type BlockDocumentBlockSummaryAugmenter = (params: {
  block: BlockDocumentBlock;
  summary: BlockDocumentBlockSummary;
  index: number;
}) => Record<string, unknown> | undefined;

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
  /** Optional host-specific summary metadata, such as runtime issues. */
  augmentBlockSummary?: BlockDocumentBlockSummaryAugmenter;
};

/**
 * Creates a tool for listing block-document blocks so agents can reuse or
 * update existing blocks instead of creating duplicates.
 */
export function createListBlockDocumentBlocksTool({
  blockDocumentAdapter,
  blockDocumentId,
  usageHint,
  augmentBlockSummary,
}: CreateListBlockDocumentBlocksToolOptions) {
  return tool<
    ListBlockDocumentBlocksToolInput,
    ListBlockDocumentBlocksToolOutput
  >({
    description: [
      'List existing blocks in the block document.',
      'Use this when the supplied document snapshot or latest tool results lack the needed block IDs or current order.',
      usageHint,
    ]
      .filter(Boolean)
      .join('\n\n'),
    inputSchema: ListBlockDocumentBlocksToolInput,
    execute: async () => {
      try {
        const nodes = blockDocumentAdapter.getBlocks(blockDocumentId);
        return {
          success: true,
          blockDocumentId,
          documentExists: nodes !== undefined,
          blocks: (nodes ?? [])
            .map((node, index) =>
              (() => {
                const block = blockDocumentNodeToBlock(node);
                const summary = summarizeBlockDocumentBlock(block, index);
                if (!block || !summary) return undefined;

                return {
                  ...summary,
                  ...(augmentBlockSummary?.({block, summary, index}) ?? {}),
                };
              })(),
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
