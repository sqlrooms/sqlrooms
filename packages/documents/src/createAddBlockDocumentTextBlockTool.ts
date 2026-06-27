import {tool} from 'ai';
import {z} from 'zod';
import type {BlockDocumentAiAdapter} from './BlockDocumentAi';
import {
  type BlockDocumentBlock,
  type BlockDocumentHeadingBlock,
  type BlockDocumentListBlock,
  type BlockDocumentParagraphBlock,
} from './BlockDocumentSliceConfig';
import {createDefaultBlockDocumentBlockId} from './BlockDocumentEditor/BlockDocumentEditorContext';

const AddBlockDocumentTextBlockParameters = z.object({
  type: z
    .enum(['heading', 'paragraph', 'list'])
    .describe('Type of text block to create'),
  text: z
    .string()
    .optional()
    .describe('Text content for heading and paragraph blocks.'),
  level: z
    .union([z.literal(1), z.literal(2), z.literal(3)])
    .optional()
    .default(2)
    .describe('Heading level from 1 to 3. Only used for heading blocks.'),
  items: z
    .array(z.string())
    .optional()
    .describe('List items. Only used for list blocks.'),
  ordered: z
    .boolean()
    .optional()
    .default(false)
    .describe('Whether list blocks should be numbered.'),
});

const AddBlockDocumentTextBlockToolInput = z.object({
  reasoning: z.string().describe('Brief rationale for the text block choice.'),
  ...AddBlockDocumentTextBlockParameters.shape,
});

type AddBlockDocumentTextBlockToolInput = z.infer<
  typeof AddBlockDocumentTextBlockToolInput
>;

type BlockDocumentToolOutput<T> =
  | ({success: true} & T)
  | {success: false; errorMessage: string};

type AddBlockDocumentTextBlockToolOutput = BlockDocumentToolOutput<{
  blockId?: string;
  message?: string;
}>;

/**
 * Creates a heading, paragraph, or list block with a unique block ID.
 */
export function createBlockDocumentTextBlock(
  params: AddBlockDocumentTextBlockToolInput,
): BlockDocumentBlock {
  const blockId = createDefaultBlockDocumentBlockId();

  switch (params.type) {
    case 'heading':
      return {
        type: 'heading',
        id: blockId,
        level: params.level || 2,
        text: params.text || '',
      } satisfies BlockDocumentHeadingBlock;

    case 'list':
      return {
        type: 'list',
        id: blockId,
        items: params.items || [],
        ordered: params.ordered || false,
      } satisfies BlockDocumentListBlock;

    case 'paragraph':
      return {
        type: 'paragraph',
        id: blockId,
        text: params.text || '',
      } satisfies BlockDocumentParagraphBlock;
  }
}

/**
 * Options for creating a generic block-document text block tool.
 */
export type CreateAddBlockDocumentTextBlockToolOptions = {
  /** Adapter for block document operations. */
  blockDocumentAdapter: BlockDocumentAiAdapter;
  /** ID of the block document where text blocks will be added. */
  blockDocumentId: string;
};

/**
 * Creates a tool for adding text blocks to a block document.
 */
export function createAddBlockDocumentTextBlockTool({
  blockDocumentAdapter,
  blockDocumentId,
}: CreateAddBlockDocumentTextBlockToolOptions) {
  return tool<
    AddBlockDocumentTextBlockToolInput,
    AddBlockDocumentTextBlockToolOutput
  >({
    description: `Add a text block to the block document.
Use this to add context, summaries, or explanations alongside other blocks.

Block types:
- heading: Section title (level 1-3)
- paragraph: Regular text content
- list: Bullet or numbered list of items`,
    inputSchema: AddBlockDocumentTextBlockToolInput,
    execute: async (params) => {
      try {
        blockDocumentAdapter.ensureBlockDocument(blockDocumentId);
        const block = createBlockDocumentTextBlock(params);
        const blockId = blockDocumentAdapter.addBlock(blockDocumentId, block);

        return {
          success: true,
          blockId,
          message: `Added ${params.type} block to block document`,
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
