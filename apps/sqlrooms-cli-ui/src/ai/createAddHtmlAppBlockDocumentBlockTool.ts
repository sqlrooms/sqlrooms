import {createHtmlAppBlockDocumentBlock as createHtmlAppRuntimeBlockDocumentBlock} from '@sqlrooms/app-runtime';
import {
  createDefaultBlockDocumentBlockId,
  type BlockDocumentAiAdapter,
  type BlockDocumentStatefulBlockBlock,
} from '@sqlrooms/documents';
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

type AddHtmlAppBlockToolOutput =
  | {
      success: true;
      appId: string;
      blockId: string;
      message: string;
    }
  | {success: false; errorMessage: string};

/**
 * Creates the block-document wrapper for an owned HTML app runtime.
 */
export function createHtmlAppBlockDocumentBlock({
  title,
  intent,
  height = 560,
  appId = createDefaultBlockDocumentBlockId(),
  blockId = createDefaultBlockDocumentBlockId(),
}: {
  title: string;
  intent?: string;
  height?: number;
  appId?: string;
  blockId?: string;
}): {appId: string; block: BlockDocumentStatefulBlockBlock} {
  const {appId: runtimeAppId, block: runtimeBlock} =
    createHtmlAppRuntimeBlockDocumentBlock({
      appId,
      blockId,
      title,
      intent,
      height,
    });
  const block: BlockDocumentStatefulBlockBlock = runtimeBlock;
  return {
    appId: runtimeAppId,
    block,
  };
}

/**
 * Options for creating the CLI HTML app block-document tool.
 */
export type CreateAddHtmlAppBlockDocumentBlockToolOptions = {
  blockDocumentAdapter: BlockDocumentAiAdapter;
  blockDocumentId: string;
  addHtmlAppBlock?: (params: {
    title: string;
    intent?: string;
  }) => Promise<{appId: string; blockId: string}>;
  createHtmlAppBlock?: (params: {
    title: string;
    intent?: string;
  }) =>
    | {appId: string; block: BlockDocumentStatefulBlockBlock}
    | Promise<{appId: string; block: BlockDocumentStatefulBlockBlock}>;
};

/**
 * Creates a tool for adding empty HTML app block containers to a worksheet
 * block document.
 */
export function createAddHtmlAppBlockDocumentBlockTool({
  blockDocumentAdapter,
  blockDocumentId,
  addHtmlAppBlock,
  createHtmlAppBlock,
}: CreateAddHtmlAppBlockDocumentBlockToolOptions) {
  return tool<AddHtmlAppBlockToolInput, AddHtmlAppBlockToolOutput>({
    description: `Create an EMPTY html-app block container in the worksheet.

This tool ONLY creates the container structure. To write app files and observe runtime diagnostics, use embedded_html_app_agent afterward with the returned appId.

Use this when you need to create a custom HTML, D3, Chart.js, or browser app block inside a worksheet.`,
    inputSchema: AddHtmlAppBlockToolInput,
    execute: async ({appTitle, intent}) => {
      try {
        if (addHtmlAppBlock) {
          const result = await addHtmlAppBlock({title: appTitle, intent});
          return {
            success: true,
            appId: result.appId,
            blockId: result.blockId,
            message: 'Added HTML app block to worksheet',
          };
        }

        blockDocumentAdapter.ensureBlockDocument(blockDocumentId);
        blockDocumentAdapter.setCurrentBlockDocument(blockDocumentId);

        const {appId, block} = createHtmlAppBlock
          ? await createHtmlAppBlock({title: appTitle, intent})
          : createHtmlAppBlockDocumentBlock({
              title: appTitle,
              intent,
            });
        const blockId = await blockDocumentAdapter.addBlock(
          blockDocumentId,
          block,
        );

        return {
          success: true,
          appId,
          blockId,
          message: 'Added HTML app block to worksheet',
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
