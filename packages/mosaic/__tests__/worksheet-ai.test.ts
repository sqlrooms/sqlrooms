import {blockDocumentBlockToNode} from '@sqlrooms/documents';
import {tool} from 'ai';
import {z} from 'zod';
import {createWorksheetAiTools} from '../src/ai/worksheet/createWorksheetAiTools';
import {KnownWorksheetTools} from '../src/ai/worksheet/constants';
import type {DatabaseAiAdapter} from '../src/ai/database-types';
import type {WorksheetAiAdapter} from '../src/ai/worksheet/worksheet-types';

describe('createWorksheetAiTools', () => {
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
      ],
      addBlock: () => 'block-id',
      addDashboardBlock: () => ({
        blockId: 'block-id',
        dashboardId: 'dashboard-id',
      }),
      addDataTableExplorerBlock: () => 'block-id',
    };

    const databaseAdapter: DatabaseAiAdapter = {
      getTables: () => [],
      findTable: () => undefined,
    };

    const tools = createWorksheetAiTools({
      databaseAdapter,
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
      ],
    });
  });
});
