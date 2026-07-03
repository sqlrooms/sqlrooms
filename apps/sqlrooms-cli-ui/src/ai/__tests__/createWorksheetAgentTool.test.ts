import {jest} from '@jest/globals';
import type {
  BlockDocumentAiAdapter,
  BlockDocumentBlockType,
} from '@sqlrooms/documents';
import type {BaseAgentToolOptions} from '@sqlrooms/mosaic/ai';
import {tool} from 'ai';
import {z} from 'zod';
import {createWorksheetAgentTool} from '../createWorksheetAgentTool';
import type {RoomState} from '../../store-types';

type RunSubAgent = BaseAgentToolOptions<RoomState>['runSubAgent'];
type WorksheetAgentToolResult = {
  success: boolean;
  finalOutput: string;
  worksheetId: string;
  metadata?: {
    stepsExecuted: number;
    queriesRun: number;
  };
};
type TestBlockDocumentAiAdapter = BlockDocumentAiAdapter & {
  moveBlock(
    blockDocumentId: string,
    blockId: string,
    toIndex: number,
  ): boolean | Promise<boolean>;
};

describe('createWorksheetAgentTool', () => {
  it('retries when the sub-agent returns text without mutating the worksheet', async () => {
    const blocks: BlockDocumentBlockType[] = [];
    const addBlock: BlockDocumentAiAdapter['addBlock'] = async (
      _worksheetId,
      block,
    ) => {
      blocks.push(block);
      return block.id;
    };
    const blockDocumentAdapter: TestBlockDocumentAiAdapter = {
      ensureBlockDocument: jest.fn(),
      setCurrentBlockDocument: jest.fn(),
      getBlocks: jest.fn(() => blocks),
      addBlock,
      moveBlock: jest.fn(() => true),
    };
    const runSubAgent = jest
      .fn<RunSubAgent>()
      .mockImplementationOnce(async () => ({
        finalOutput: 'I added the chart.',
        agentToolCalls: [{toolName: 'query'}],
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

    const result = (await (
      worksheetAgent as unknown as {
        execute: (
          input: {
            reasoning: string;
            intent: string;
            worksheetId: string;
            maxSteps: number;
          },
          options: {toolCallId: string},
        ) => Promise<WorksheetAgentToolResult>;
      }
    ).execute(
      {
        reasoning: 'test',
        intent: 'add a scatter plot',
        worksheetId: 'worksheet-1',
        maxSteps: 5,
      },
      {toolCallId: 'parent-tool'},
    )) as WorksheetAgentToolResult;

    expect(result).toMatchObject({
      success: true,
      finalOutput: 'Chart added.',
      worksheetId: 'worksheet-1',
    });
    expect(runSubAgent).toHaveBeenCalledTimes(2);
    expect(runSubAgent.mock.calls[1]?.[0].prompt).toContain(
      'did not modify the worksheet',
    );
    expect(result.metadata).toEqual({
      stepsExecuted: 2,
      queriesRun: 1,
    });
  });

  it('allows read-only worksheet requests to return text without mutation', async () => {
    const blocks: BlockDocumentBlockType[] = [];
    const addBlock: BlockDocumentAiAdapter['addBlock'] = async (
      _worksheetId,
      block,
    ) => {
      blocks.push(block);
      return block.id;
    };
    const blockDocumentAdapter: TestBlockDocumentAiAdapter = {
      ensureBlockDocument: jest.fn(),
      setCurrentBlockDocument: jest.fn(),
      getBlocks: jest.fn(() => blocks),
      addBlock,
      moveBlock: jest.fn(() => true),
    };
    const runSubAgent = jest.fn<RunSubAgent>().mockResolvedValue({
      finalOutput: 'The worksheet has MPG and Weight columns.',
      agentToolCalls: [{toolName: 'query'}],
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

    const result = (await (
      worksheetAgent as unknown as {
        execute: (
          input: {
            reasoning: string;
            intent: string;
            worksheetId: string;
            maxSteps: number;
          },
          options: {toolCallId: string},
        ) => Promise<WorksheetAgentToolResult>;
      }
    ).execute(
      {
        reasoning: 'test',
        intent: 'what columns are in this worksheet?',
        worksheetId: 'worksheet-1',
        maxSteps: 5,
      },
      {toolCallId: 'parent-tool'},
    )) as WorksheetAgentToolResult;

    expect(result).toMatchObject({
      success: true,
      finalOutput: 'The worksheet has MPG and Weight columns.',
      worksheetId: 'worksheet-1',
      metadata: {
        stepsExecuted: 1,
        queriesRun: 1,
      },
    });
    expect(runSubAgent).toHaveBeenCalledTimes(1);
    expect(blocks).toEqual([]);
  });

  it('passes source and target block document IDs to the sub-agent for copy-like requests', async () => {
    const blocks: BlockDocumentBlockType[] = [];
    const blockDocumentAdapter: TestBlockDocumentAiAdapter = {
      ensureBlockDocument: jest.fn(),
      setCurrentBlockDocument: jest.fn(),
      getBlocks: jest.fn(() => blocks),
      addBlock: jest.fn<BlockDocumentAiAdapter['addBlock']>(
        (_worksheetId, block) => block.id,
      ),
      moveBlock: jest.fn(() => true),
    };
    const runSubAgent = jest.fn<RunSubAgent>().mockImplementation(async () => {
      blocks.push({
        id: 'chart-copy',
        type: 'chart',
        tableName: '"main"."cars"',
        config: {chartType: 'scatter'},
      });
      return {
        finalOutput: 'Copied chart.',
        agentToolCalls: [{toolName: 'copy_block_document_blocks'}],
      };
    });

    const worksheetAgent = createWorksheetAgentTool({
      store: {
        getState: () =>
          ({
            artifacts: {
              config: {currentArtifactId: 'source-worksheet'},
              getArtifact: (artifactId: string) =>
                artifactId === 'source-worksheet'
                  ? {
                      id: 'source-worksheet',
                      type: 'worksheet',
                      title: 'Source Worksheet',
                    }
                  : undefined,
            },
          }) as any,
      },
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

    const result = (await (
      worksheetAgent as unknown as {
        execute: (
          input: {
            reasoning: string;
            intent: string;
            worksheetId: string;
            maxSteps: number;
          },
          options: {toolCallId: string},
        ) => Promise<WorksheetAgentToolResult>;
      }
    ).execute(
      {
        reasoning: 'test',
        intent: 'create a new worksheet with the same chart',
        worksheetId: 'target-worksheet',
        maxSteps: 5,
      },
      {toolCallId: 'parent-tool'},
    )) as WorksheetAgentToolResult;

    expect(result.success).toBe(true);
    expect(runSubAgent).toHaveBeenCalledTimes(1);
    expect(runSubAgent.mock.calls[0]?.[0].prompt).toContain(
      'Target worksheet block document artifact ID: target-worksheet',
    );
    expect(runSubAgent.mock.calls[0]?.[0].prompt).toContain(
      'Source worksheet block document artifact ID: source-worksheet',
    );
    expect(runSubAgent.mock.calls[0]?.[0].prompt).toContain(
      'copy_block_document_blocks',
    );
  });
});
