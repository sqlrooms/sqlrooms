import {
  createDefaultBlockDocumentBlockId,
  type BlockDocumentStatefulBlockBlock,
} from '@sqlrooms/documents';
import {tool} from 'ai';
import {z} from 'zod';

import {ToolOutput} from '../tool-types';
import type {WorksheetAiAdapter} from './worksheet-types';

const AddHtmlAppBlockToolInput = z.object({
  reasoning: z.string().describe('Brief rationale for HTML app block choice.'),
  appTitle: z.string().describe('The title of the HTML app block.'),
});

type AddHtmlAppBlockToolInput = z.infer<typeof AddHtmlAppBlockToolInput>;

type AddHtmlAppBlockToolOutput = ToolOutput<{
  appId?: string;
  blockId?: string;
  message?: string;
}>;

/**
 * Options for creating the add HTML app block tool.
 * Provides worksheet context for adding HTML app blocks to a specific worksheet.
 */
export type CreateAddHtmlAppBlockToolOptions = {
  /** Adapter for worksheet operations */
  worksheetAdapter: WorksheetAiAdapter;
  /** ID of the worksheet where HTML app blocks will be added */
  worksheetId: string;
};

/**
 * Creates a tool for adding empty HTML app block containers to a worksheet.
 */
export function createAddHtmlAppBlockTool({
  worksheetAdapter,
  worksheetId,
}: CreateAddHtmlAppBlockToolOptions) {
  return tool<AddHtmlAppBlockToolInput, AddHtmlAppBlockToolOutput>({
    description: `Create an EMPTY html-app block container in the worksheet.

This tool ONLY creates the container structure. To write app files and observe runtime diagnostics, use embedded_html_app_agent afterward with the returned appId.

Use this when you need to create a custom HTML, D3, Chart.js, or browser app block inside a worksheet.`,
    inputSchema: AddHtmlAppBlockToolInput,
    execute: async ({appTitle}) => {
      try {
        worksheetAdapter.ensureWorksheet(worksheetId);
        worksheetAdapter.setCurrentWorksheet(worksheetId);

        const appId = createDefaultBlockDocumentBlockId();
        const block: BlockDocumentStatefulBlockBlock = {
          type: 'statefulBlock',
          id: createDefaultBlockDocumentBlockId(),
          blockType: 'html-app',
          blockInstanceId: appId,
          ownership: 'owned',
          title: appTitle,
          caption: appTitle,
          height: 560,
        };

        const blockId = worksheetAdapter.addBlock(worksheetId, block);

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
