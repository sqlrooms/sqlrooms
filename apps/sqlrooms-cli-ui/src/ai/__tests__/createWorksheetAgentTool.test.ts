import {jest} from '@jest/globals';
import type {BlockDocumentAiAdapter} from '@sqlrooms/documents';
import {tool} from 'ai';
import {z} from 'zod';
import {createWorksheetAgentTool} from '../createWorksheetAgentTool';

describe('createWorksheetAgentTool', () => {
  it('retries when the sub-agent returns text without mutating the worksheet', async () => {
    const blocks: any[] = [];
    const blockDocumentAdapter: BlockDocumentAiAdapter = {
      ensureBlockDocument: jest.fn(),
      setCurrentBlockDocument: jest.fn(),
      getBlocks: jest.fn(() => blocks),
      addBlock: jest.fn(async (_worksheetId, block) => {
        blocks.push(block);
        return block.id;
      }),
    };
    const runSubAgent = jest
      .fn()
      .mockImplementationOnce(async () => ({
        finalOutput: 'I added the chart.',
        agentToolCalls: [],
      }))
      .mockImplementationOnce(async () => {
        blocks.push({
          id: 'chart-1',
          type: 'chart',
          tableName: '"main"."cars"',
          config: {chartType: 'scatter'},
        });
        return {
          finalOutput: 'Chart added.',
          agentToolCalls: [
            {
              toolName: 'create_block_document_chart_scatter',
            },
          ],
        };
      });

    const worksheetAgent = createWorksheetAgentTool({
      store: {getState: () => ({}) as any},
      getModel: () => ({}) as any,
      runSubAgent,
      databaseAdapter: {
        getTables: () => [],
        findTable: () => undefined,
      },
      blockDocumentAdapter,
      dashboardAgentTool: tool({
        description: 'No-op dashboard agent for tests.',
        inputSchema: z.object({}),
        execute: async () => ({success: true}),
      }),
      htmlAppBlocksEnabled: false,
      createDashboardBlock: jest.fn() as any,
      createDataTableExplorerBlock: jest.fn() as any,
    });

    const result = await (worksheetAgent as any).execute(
      {
        reasoning: 'test',
        intent: 'add a scatter plot',
        worksheetId: 'worksheet-1',
        maxSteps: 5,
      },
      {toolCallId: 'parent-tool'},
    );

    expect(result).toMatchObject({
      success: true,
      finalOutput: 'Chart added.',
      worksheetId: 'worksheet-1',
    });
    expect(runSubAgent).toHaveBeenCalledTimes(2);
    expect(runSubAgent.mock.calls[1]?.[0].prompt).toContain(
      'did not modify the worksheet',
    );
  });
});
