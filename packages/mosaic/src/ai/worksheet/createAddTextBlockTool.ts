import {tool} from 'ai';
import {z} from 'zod';
import {
  createDefaultBlockDocumentBlockId,
  BlockDocumentParagraphBlock,
  type BlockDocumentBlock,
  BlockDocumentListBlock,
  BlockDocumentHeadingBlock,
} from '@sqlrooms/documents';
import type {WorksheetAiAdapter} from './worksheet-types';
import {ToolOutput} from '../tool-types';

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

type AddTextBlockToolOutput = ToolOutput<{
  blockId?: string;
  message?: string;
}>;

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

export type CreateAddTextBlockToolOptions = {
  worksheetAdapter: WorksheetAiAdapter;
  worksheetId: string;
};

/**
 * Creates a tool for adding text blocks to a worksheet.
 */
export function createAddTextBlockTool({
  worksheetAdapter,
  worksheetId,
}: CreateAddTextBlockToolOptions) {
  return tool<AddTextBlockToolInput, AddTextBlockToolOutput>({
    description: `Add a text block to the worksheet.
Use this to add context, summaries, or explanations alongside charts.

Block types:
- heading: Section title (level 1-3)
- paragraph: Regular text content
- list: Bullet or numbered list of items`,
    inputSchema: AddTextBlockToolInput,
    execute: async (params) => {
      try {
        const block = createTextBlock(params);

        const blockId = worksheetAdapter.addBlock(worksheetId, block);

        return {
          success: true,
          blockId,
          message: `Added ${params.type} block to worksheet`,
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
