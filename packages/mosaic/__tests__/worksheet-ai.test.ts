import {
  blockDocumentBlockToNode,
  type BlockDocumentBlock,
} from '@sqlrooms/documents';
import {jest} from '@jest/globals';
import {tool} from 'ai';
import {z} from 'zod';
import {createWorksheetAiTools} from '../src/ai/worksheet/createWorksheetAiTools';
import {KnownWorksheetTools} from '../src/ai/worksheet/constants';
import type {DatabaseAiAdapter} from '../src/ai/database-types';
import type {WorksheetAiAdapter} from '../src/ai/worksheet/worksheet-types';

describe('createWorksheetAiTools', () => {
  function createMockDatabaseAdapter(): DatabaseAiAdapter {
    return {
      getTables: () => [],
      findTable: () => undefined,
    };
  }

  it('lists existing dashboard blocks so agents can update them', async () => {
    const worksheetAdapter: WorksheetAiAdapter = {
      setCurrentWorksheet: () => {},
      ensureWorksheet: () => {},
      getBlocks: () => [
        blockDocumentBlockToNode({
          type: 'statefulBlock',
          id: 'block-1',
          blockType: 'dashboard',
          blockInstanceId: 'dashboard-1',
          caption: 'Earthquake dashboard',
        }),
        blockDocumentBlockToNode({
          type: 'statefulBlock',
          id: 'block-2',
          blockType: 'html-app',
          blockInstanceId: 'html-app-1',
          title: 'Country Explorer',
        }),
      ],
      addBlock: () => 'block-id',
      addDashboardBlock: () => ({
        blockId: 'block-id',
        dashboardId: 'dashboard-id',
      }),
      addDataTableExplorerBlock: () => 'block-id',
    };

    const tools = createWorksheetAiTools({
      databaseAdapter: createMockDatabaseAdapter(),
      worksheetAdapter,
      worksheetId: 'worksheet-1',
      dashboardAgentTool: tool({
        description: 'mock dashboard agent',
        inputSchema: z.object({}),
        execute: async () => ({success: true}),
      }),
    });

    const result = await (
      tools[KnownWorksheetTools.list_blocks] as any
    ).execute({});

    expect(result).toEqual({
      success: true,
      blocks: [
        {
          blockId: 'block-1',
          type: 'statefulBlock',
          blockType: 'dashboard',
          dashboardId: 'dashboard-1',
          caption: 'Earthquake dashboard',
        },
        {
          blockId: 'block-2',
          type: 'statefulBlock',
          blockType: 'html-app',
          htmlAppId: 'html-app-1',
          title: 'Country Explorer',
        },
      ],
    });
  });

  it('adds an empty html-app block container without writing runtime state', async () => {
    const addBlock = jest.fn(
      (_worksheetId: string, block: BlockDocumentBlock) => block.id,
    );
    const worksheetAdapter: WorksheetAiAdapter = {
      setCurrentWorksheet: jest.fn(),
      ensureWorksheet: jest.fn(),
      getBlocks: () => [],
      addBlock,
      addDashboardBlock: () => ({
        blockId: 'dashboard-block-id',
        dashboardId: 'dashboard-id',
      }),
      addDataTableExplorerBlock: () => 'table-block-id',
    };

    const tools = createWorksheetAiTools({
      databaseAdapter: createMockDatabaseAdapter(),
      worksheetAdapter,
      worksheetId: 'worksheet-1',
      dashboardAgentTool: tool({
        description: 'mock dashboard agent',
        inputSchema: z.object({}),
        execute: async () => ({success: true}),
      }),
    });

    const result = await (
      tools[KnownWorksheetTools.add_html_app_block] as any
    ).execute({
      reasoning: 'The user asked for a custom D3 app.',
      intent: 'Build a country explorer app.',
      appTitle: 'Country Explorer',
    });

    expect(result.success).toBe(true);
    expect(result.appId).toEqual(expect.any(String));
    expect(result.blockId).toEqual(expect.any(String));
    expect(result.message).toBe('Added HTML app block to worksheet');
    expect(worksheetAdapter.ensureWorksheet).toHaveBeenCalledWith(
      'worksheet-1',
    );
    expect(worksheetAdapter.setCurrentWorksheet).toHaveBeenCalledWith(
      'worksheet-1',
    );
    expect(addBlock).toHaveBeenCalledTimes(1);
    expect(addBlock).toHaveBeenCalledWith(
      'worksheet-1',
      expect.objectContaining({
        type: 'statefulBlock',
        blockType: 'html-app',
        blockInstanceId: result.appId,
        ownership: 'owned',
        intent: 'Build a country explorer app.',
        title: 'Country Explorer',
        caption: 'Country Explorer',
        height: 560,
      }),
    );
  });

  it('lets existing worksheet html-app blocks be updated by appId without creating another block', async () => {
    const addBlock = jest.fn(
      (_worksheetId: string, block: BlockDocumentBlock) => block.id,
    );
    const embeddedHtmlAppAgent = tool({
      description: 'mock embedded html app agent',
      inputSchema: z.object({appId: z.string(), intent: z.string()}),
      execute: async ({appId}) => ({success: true, appId}),
    });
    const worksheetAdapter: WorksheetAiAdapter = {
      setCurrentWorksheet: () => {},
      ensureWorksheet: () => {},
      getBlocks: () => [
        blockDocumentBlockToNode({
          type: 'statefulBlock',
          id: 'block-2',
          blockType: 'html-app',
          blockInstanceId: 'html-app-1',
          title: 'Country Explorer',
        }),
      ],
      addBlock,
      addDashboardBlock: () => ({
        blockId: 'dashboard-block-id',
        dashboardId: 'dashboard-id',
      }),
      addDataTableExplorerBlock: () => 'table-block-id',
    };

    const tools = createWorksheetAiTools({
      databaseAdapter: createMockDatabaseAdapter(),
      worksheetAdapter,
      worksheetId: 'worksheet-1',
      dashboardAgentTool: tool({
        description: 'mock dashboard agent',
        inputSchema: z.object({}),
        execute: async () => ({success: true}),
      }),
      extraTools: () => ({
        [KnownWorksheetTools.embedded_html_app_agent]: embeddedHtmlAppAgent,
      }),
    });

    const listResult = await (
      tools[KnownWorksheetTools.list_blocks] as any
    ).execute({});
    const htmlAppBlock = listResult.blocks.find(
      (block: {blockType?: string}) => block.blockType === 'html-app',
    );
    const updateResult = await (
      tools[KnownWorksheetTools.embedded_html_app_agent] as any
    ).execute({
      appId: htmlAppBlock.htmlAppId,
      intent: 'Update the existing app.',
    });

    expect(updateResult).toEqual({success: true, appId: 'html-app-1'});
    expect(addBlock).not.toHaveBeenCalled();
  });
});
