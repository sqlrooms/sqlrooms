import {
  blockDocumentNodeToBlock,
  createDefaultBlockDocumentBlockId,
  type BlockDocumentStatefulBlockBlock,
  type BlockDocumentNode,
} from '@sqlrooms/documents';
import type {ExtraWorksheetAiToolsParams} from '@sqlrooms/mosaic/ai';
import {tool} from 'ai';
import type {StoreApi} from 'zustand';
import {z} from 'zod';
import {
  HtmlAppRuntimeInputSchema,
  writeHtmlAppRuntimeState,
} from './createHtmlAppAgent';
import type {RoomState} from './store-types';

const EmbeddedHtmlAppAgentInputSchema = HtmlAppRuntimeInputSchema.extend({
  appId: z
    .string()
    .optional()
    .describe(
      'Existing embedded html-app blockInstanceId to update. Use list_worksheet_blocks first when modifying an existing worksheet app.',
    ),
});

type EmbeddedHtmlAppAgentInput = z.infer<
  typeof EmbeddedHtmlAppAgentInputSchema
>;

export function createEmbeddedHtmlAppAgentTool(
  store: StoreApi<RoomState>,
  {worksheetId, worksheetAdapter}: ExtraWorksheetAiToolsParams,
) {
  return tool({
    description: `Create or update an embedded html-app block inside the current worksheet.

Use this from worksheet_agent when the user asks for an HTML, D3, Chart.js, or browser app visualization inside a worksheet. This tool ensures the worksheet contains an owned html-app stateful block, then writes durable html-app runtime state through the same app-id writer used by top-level html_app_agent.`,
    inputSchema: EmbeddedHtmlAppAgentInputSchema,
    execute: async (input): Promise<Record<string, unknown>> => {
      worksheetAdapter.ensureWorksheet(worksheetId);
      worksheetAdapter.setCurrentWorksheet(worksheetId);

      const title = input.title?.trim() || 'HTML App';
      const target = resolveEmbeddedHtmlAppTarget({
        blocks: worksheetAdapter.getBlocks(worksheetId) ?? [],
        input,
      });
      const appId = target.appId ?? createDefaultBlockDocumentBlockId();
      const blockId = target.blockId ?? createDefaultBlockDocumentBlockId();

      if (!target.blockId) {
        const block: BlockDocumentStatefulBlockBlock = {
          type: 'statefulBlock',
          id: blockId,
          blockType: 'html-app',
          blockInstanceId: appId,
          ownership: 'owned',
          title,
          caption: title,
          height: 560,
        };
        worksheetAdapter.addBlock(worksheetId, block);
      }

      const result = await writeHtmlAppRuntimeState(store, {
        ...input,
        appId,
        title,
      });
      return {
        ...result,
        worksheetId,
        appId,
        blockId,
        createdBlock: !target.blockId,
      };
    },
  });
}

function resolveEmbeddedHtmlAppTarget({
  blocks,
  input,
}: {
  blocks: BlockDocumentNode[];
  input: EmbeddedHtmlAppAgentInput;
}) {
  const htmlAppBlocks = blocks
    .map((node) => blockDocumentNodeToBlock(node))
    .filter(
      (block): block is BlockDocumentStatefulBlockBlock =>
        block?.type === 'statefulBlock' && block.blockType === 'html-app',
    );

  if (input.appId) {
    const target = htmlAppBlocks.find(
      (block) => block.blockInstanceId === input.appId,
    );
    return {
      appId: input.appId,
      blockId: target?.id,
    };
  }

  return {};
}
