import {tool} from 'ai';
import {z} from 'zod';
import {
  createDefaultBlockDocumentBlockId,
  BlockDocumentParagraphBlock,
  type BlockDocumentBlock,
  BlockDocumentListBlock,
  BlockDocumentHeadingBlock,
} from '../index';
import type {BlockDocumentAiAdapter} from './BlockDocumentAiAdapter';

const AddTextBlockParameters = z.object({
  type: z
    .enum(['heading', 'paragraph', 'list'])
    .describe('Type of text block to create'),
  text: z
    .string()
    .optional()
    .describe('Text content (for heading and paragraph types)'),
  level: z
    .union([z.literal(1), z.literal(2), z.literal(3)])
    .optional()
    .default(2)
    .describe('Heading level (1-3, default 2) - only for heading type'),
  items: z
    .array(z.string())
    .optional()
    .describe('List items - only for list type'),
  ordered: z
    .boolean()
    .optional()
    .default(false)
    .describe('Whether list is numbered (true) or bulleted (false)'),
});

type AddTextBlockParameters = z.infer<typeof AddTextBlockParameters>;

const AddTextBlockToolInput = z.object({
  reasoning: z.string().describe('Brief rationale for text block choice.'),
  ...AddTextBlockParameters.shape,
});

type AddTextBlockToolInput = z.infer<typeof AddTextBlockToolInput>;

type AddTextBlockToolOutput = {
  success: boolean;
  blockId?: string;
  message?: string;
  errorMessage?: string;
};

/**
 * Creates a text block (heading, paragraph, or list) with a unique ID.
 */
function createTextBlock(params: AddTextBlockToolInput): BlockDocumentBlock {
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
 * Options for creating the add block document text block tool.
 */
export type CreateAddBlockDocumentTextBlockToolOptions = {
  blockDocumentAdapter: BlockDocumentAiAdapter;
  blockDocumentId: string;
};

/**
 * Creates a tool for adding text blocks to a block document.
 */
export function createAddBlockDocumentTextBlockTool({
  blockDocumentAdapter,
  blockDocumentId,
}: CreateAddBlockDocumentTextBlockToolOptions) {
  return tool({
    description: `Add a text block to the block document.
Use this to add context, summaries, or explanations alongside other content.

Block types:
- heading: Section title (level 1-3)
- paragraph: Regular text content
- list: Bullet or numbered list of items`,
    inputSchema: AddTextBlockToolInput,
    execute: async (
      params: AddTextBlockToolInput,
    ): Promise<AddTextBlockToolOutput> => {
      try {
        const block = createTextBlock(params);

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
