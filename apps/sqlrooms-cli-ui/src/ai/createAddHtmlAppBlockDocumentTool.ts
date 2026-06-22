import {createHtmlAppBlockDocumentBlock} from '@sqlrooms/app-runtime';
import {type BlockDocumentAiAdapter} from '@sqlrooms/documents';
import {tool} from 'ai';
import {z} from 'zod';

const AddHtmlAppBlockToolInput = z.object({
  reasoning: z.string().describe('Brief rationale for HTML app block choice.'),
  intent: z
    .string()
    .optional()
    .describe('Optional natural-language objective for this HTML app block.'),
  appTitle: z.string().describe('The title of the HTML app block.'),
});

type AddHtmlAppBlockToolInput = z.infer<typeof AddHtmlAppBlockToolInput>;

type AddHtmlAppBlockToolOutput = {
  success: boolean;
  appId?: string;
  blockId?: string;
  message?: string;
  errorMessage?: string;
};

/**
 * Options for creating the add HTML app block document tool.
 */
export type CreateAddHtmlAppBlockDocumentToolOptions = {
  blockDocumentAdapter: BlockDocumentAiAdapter;
  blockDocumentId: string;
};

/**
 * Creates a tool for adding empty HTML app block containers to a block document.
 */
export function createAddHtmlAppBlockDocumentTool({
  blockDocumentAdapter,
  blockDocumentId,
}: CreateAddHtmlAppBlockDocumentToolOptions) {
  return tool<AddHtmlAppBlockToolInput, AddHtmlAppBlockToolOutput>({
    description: `Create an EMPTY html-app block container in the block document.

This tool ONLY creates the container structure. To write app files and observe runtime diagnostics, use embedded_html_app_agent afterward with the returned appId.

Use this when you need to create a custom HTML, D3, Chart.js, or browser app block.`,
    inputSchema: AddHtmlAppBlockToolInput,
    execute: async ({appTitle, intent}) => {
      try {
        blockDocumentAdapter.ensureBlockDocument(blockDocumentId);
        blockDocumentAdapter.setCurrentBlockDocument?.(blockDocumentId);

        const {appId, block} = createHtmlAppBlockDocumentBlock({
          title: appTitle,
          intent,
          height: 560,
        });

        const blockId = blockDocumentAdapter.addBlock(blockDocumentId, block);

        return {
          success: true,
          appId,
          blockId,
          message: 'Added HTML app block to block document',
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
