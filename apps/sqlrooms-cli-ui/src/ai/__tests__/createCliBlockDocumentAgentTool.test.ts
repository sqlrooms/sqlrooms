import {jest} from '@jest/globals';
import {tool, type ToolLoopAgent} from 'ai';
import {
  blockDocumentBlockToNode,
  type BlockDocumentNode,
  type BlockDocumentAiAdapter,
  type BlockDocumentMoveBlockAiAdapter,
  type BlockDocumentStatefulBlockBlock,
} from '@sqlrooms/documents';
import {DECK_MAP_DASHBOARD_PANEL_TYPE} from '@sqlrooms/deck';
import {
  BLOCK_DOCUMENT_CHART_TOOL_PREFIX,
  type DatabaseAiAdapter,
} from '@sqlrooms/mosaic/ai';
import {z} from 'zod';
import {
  createCliBlockDocumentAgentTool,
  type CreateCliBlockDocumentAgentToolOptions,
} from '../createCliBlockDocumentAgentTool';
import {KnownBlockDocumentTools} from '../constants';
import type {RoomState} from '../../store-types';

describe('createCliBlockDocumentAgentTool', () => {
  function createBlockDocumentAdapter(
    blocks: BlockDocumentNode[] = [],
  ): BlockDocumentAiAdapter & BlockDocumentMoveBlockAiAdapter {
    return {
      setCurrentBlockDocument: () => {},
      ensureBlockDocument: () => {},
      getBlocks: () => blocks,
      addBlock: (_blockDocumentId, block) => block.id,
      moveBlock: () => true,
      updateBlock: () => {},
    };
  }

  function createDatabaseAdapter(): DatabaseAiAdapter {
    return {
      getTables: () => [],
      findTable: (tableName) => ({tableName: String(tableName)}) as any,
    };
  }

  function createStatefulBlock(
    blockType: string,
    blockInstanceId: string,
  ): BlockDocumentStatefulBlockBlock {
    return {
      type: 'statefulBlock',
      id: `${blockType}-block`,
      blockType,
      blockInstanceId,
    };
  }

  function createOptions(
    overrides: Partial<CreateCliBlockDocumentAgentToolOptions> = {},
  ): CreateCliBlockDocumentAgentToolOptions {
    return {
      store: {getState: () => ({}) as RoomState},
      getModel: () => ({}) as any,
      runSubAgent: jest.fn(async () => ({})),
      databaseAdapter: createDatabaseAdapter(),
      blockDocumentAdapter: createBlockDocumentAdapter(),
      dashboardAgentTool: tool({
        description: 'mock dashboard agent',
        inputSchema: z.object({
          dashboardId: z.string().optional(),
          intent: z.string().optional(),
        }),
        execute: async () => ({success: true}),
      }),
      chartToolsOptions: {},
      createDashboardBlock: ({title}) => ({
        dashboardId: 'dashboard-1',
        block: createStatefulBlock('dashboard', title),
      }),
      createDataTableExplorerBlock: () =>
        createStatefulBlock('data-table', 'table-instance-1'),
      ...overrides,
    };
  }

  async function executeAgentTool(
    options: CreateCliBlockDocumentAgentToolOptions,
    input: Record<string, unknown>,
  ) {
    return (await (createCliBlockDocumentAgentTool(options) as any).execute(
      {
        reasoning: 'test',
        intent: 'update this block',
        blockDocumentId: 'worksheet-1',
        ...input,
      },
      {toolCallId: 'tool-call-1'},
    )) as {success: boolean; finalOutput: string; error?: string};
  }

  it.each([
    {
      blockType: 'dashboard',
      toolName: KnownBlockDocumentTools.embedded_dashboard_agent,
      idField: 'dashboardId',
    },
    {
      blockType: 'html-app',
      toolName: KnownBlockDocumentTools.embedded_html_app_agent,
      idField: 'appId',
    },
    {
      blockType: 'map',
      toolName: KnownBlockDocumentTools.create_block_document_map_block,
      idField: 'mapId',
    },
  ])(
    'restricts and pre-binds target $blockType tools',
    async ({blockType, toolName, idField}) => {
      const executeMock = jest.fn(async (input: unknown) => ({
        success: true,
        input,
      }));
      const mapStore =
        blockType === 'map'
          ? {
              getState: () =>
                ({
                  mosaicDashboard: {
                    getDashboard: () => ({
                      panels: [
                        {
                          id: 'map-panel-1',
                          type: DECK_MAP_DASHBOARD_PANEL_TYPE,
                          title: 'Existing Map',
                          config: {
                            datasets: {
                              earthquakes: {
                                tableName: 'earthquakes',
                              },
                            },
                            spec: {
                              layers: [
                                {
                                  '@@type': 'ScatterplotLayer',
                                  id: 'quakes-layer',
                                  data: 'earthquakes',
                                },
                              ],
                            },
                            mapStyle: 'light',
                          },
                        },
                      ],
                    }),
                    getPanelIssue: () => undefined,
                  },
                }) as unknown as RoomState,
            }
          : undefined;
      let capturedAgent: ToolLoopAgent<any, any, any> | undefined;
      let capturedPrompt = '';
      const options = createOptions({
        ...(mapStore ? {store: mapStore} : {}),
        blockDocumentAdapter: createBlockDocumentAdapter([
          blockDocumentBlockToNode(
            createStatefulBlock(blockType, 'target-instance-1'),
          ),
        ]),
        htmlAppBlocksEnabled: true,
        mapBlocksEnabled: true,
        dashboardAgentTool:
          toolName === KnownBlockDocumentTools.embedded_dashboard_agent
            ? tool({
                inputSchema: z.object({
                  dashboardId: z.string().optional(),
                  intent: z.string().optional(),
                }),
                execute: executeMock,
              })
            : createOptions().dashboardAgentTool,
        extraTools: () => ({
          [KnownBlockDocumentTools.embedded_html_app_agent]: tool({
            inputSchema: z.object({
              appId: z.string().optional(),
              intent: z.string().optional(),
            }),
            execute:
              toolName === KnownBlockDocumentTools.embedded_html_app_agent
                ? executeMock
                : async () => ({success: true}),
          }),
          [KnownBlockDocumentTools.create_block_document_map_block]: tool({
            inputSchema: z.object({
              mapId: z.string().optional(),
              intent: z.string().optional(),
            }),
            execute:
              toolName ===
              KnownBlockDocumentTools.create_block_document_map_block
                ? executeMock
                : async () => ({success: true}),
          }),
        }),
        runSubAgent: jest.fn<
          CreateCliBlockDocumentAgentToolOptions['runSubAgent']
        >(async ({agent, prompt}) => {
          capturedAgent = agent;
          capturedPrompt = prompt;
          await (agent.tools[toolName] as any).execute({
            [idField]: 'model-chosen-id',
            intent: 'edit it',
          });
          return {};
        }),
      });

      const result = await executeAgentTool(options, {
        targetBlock: {
          blockId: `${blockType}-block`,
          blockType,
          blockInstanceId: 'target-instance-1',
        },
      });

      expect(result).toMatchObject({
        success: true,
        finalOutput: 'Worksheet block updated successfully.',
      });
      expect(Object.keys(capturedAgent?.tools ?? {})).toEqual([toolName]);
      expect(executeMock).toHaveBeenCalledWith(
        expect.objectContaining({[idField]: 'target-instance-1'}),
        undefined,
      );
      expect(capturedPrompt).toContain(`blockType: ${blockType}`);
      expect(capturedPrompt).toContain('blockInstanceId: target-instance-1');
      if (blockType === 'map') {
        expect(capturedPrompt).toContain('Existing map panel state');
        expect(capturedPrompt).toContain('Existing Map');
        expect(capturedPrompt).toContain('earthquakes');
        expect(capturedPrompt).toContain('quakes-layer');
      }
      expect((capturedAgent as any).settings.instructions).toContain(
        `${idField} is pre-bound`,
      );
    },
  );

  it('restricts chart target blocks to worksheet chart tools', async () => {
    let capturedAgent: ToolLoopAgent<any, any, any> | undefined;
    const options = createOptions({
      htmlAppBlocksEnabled: false,
      runSubAgent: jest.fn<
        CreateCliBlockDocumentAgentToolOptions['runSubAgent']
      >(async ({agent}) => {
        capturedAgent = agent;
        return {finalOutput: 'chart updated'};
      }),
    });

    const result = await executeAgentTool(options, {
      targetBlock: {
        blockId: 'chart-block-1',
        blockType: 'chart',
      },
    });

    const toolNames = Object.keys(capturedAgent?.tools ?? {});
    expect(result.finalOutput).toBe('chart updated');
    expect(toolNames.length).toBeGreaterThan(0);
    expect(
      toolNames.every((toolName) =>
        toolName.startsWith(BLOCK_DOCUMENT_CHART_TOOL_PREFIX),
      ),
    ).toBe(true);
  });

  it('fails when no target-block tool is available', async () => {
    const runSubAgent = jest.fn(async () => ({}));
    const result = await executeAgentTool(
      createOptions({
        blockDocumentAdapter: createBlockDocumentAdapter([
          blockDocumentBlockToNode(createStatefulBlock('html-app', 'app-1')),
        ]),
        htmlAppBlocksEnabled: false,
        runSubAgent,
      }),
      {
        targetBlock: {
          blockId: 'html-app-block',
          blockType: 'html-app',
          blockInstanceId: 'app-1',
        },
      },
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('No target-block tool available for html-app.');
    expect(runSubAgent).not.toHaveBeenCalled();
  });

  it('validates target block instance ids for stateful block edits', async () => {
    const result = await executeAgentTool(createOptions(), {
      targetBlock: {
        blockId: 'dashboard-block-1',
        blockType: 'dashboard',
      },
    });

    expect(result.success).toBe(false);
    expect(result.finalOutput).toBe(
      'dashboard block dashboard-block-1 is missing blockInstanceId.',
    );
  });

  it('fails stateful target edits when the block id is stale', async () => {
    const runSubAgent = jest.fn(async () => ({}));
    const result = await executeAgentTool(
      createOptions({
        blockDocumentAdapter: createBlockDocumentAdapter([
          blockDocumentBlockToNode(
            createStatefulBlock('dashboard', 'target-instance-1'),
          ),
        ]),
        runSubAgent,
      }),
      {
        targetBlock: {
          blockId: 'missing-block',
          blockType: 'dashboard',
          blockInstanceId: 'target-instance-1',
        },
      },
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe(
      'Target block missing-block was not found in worksheet worksheet-1.',
    );
    expect(runSubAgent).not.toHaveBeenCalled();
  });

  it('fails stateful target edits when the block type changed', async () => {
    const runSubAgent = jest.fn(async () => ({}));
    const result = await executeAgentTool(
      createOptions({
        blockDocumentAdapter: createBlockDocumentAdapter([
          blockDocumentBlockToNode(
            createStatefulBlock('map', 'target-instance-1'),
          ),
        ]),
        runSubAgent,
      }),
      {
        targetBlock: {
          blockId: 'map-block',
          blockType: 'dashboard',
          blockInstanceId: 'target-instance-1',
        },
      },
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe(
      'Target block map-block is a map block, not a dashboard block.',
    );
    expect(runSubAgent).not.toHaveBeenCalled();
  });

  it('fails stateful target edits when the backing instance id changed', async () => {
    const runSubAgent = jest.fn(async () => ({}));
    const result = await executeAgentTool(
      createOptions({
        blockDocumentAdapter: createBlockDocumentAdapter([
          blockDocumentBlockToNode(
            createStatefulBlock('dashboard', 'current-instance-1'),
          ),
        ]),
        runSubAgent,
      }),
      {
        targetBlock: {
          blockId: 'dashboard-block',
          blockType: 'dashboard',
          blockInstanceId: 'stale-instance-1',
        },
      },
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe(
      'Target block dashboard-block instance id does not match the current worksheet block.',
    );
    expect(runSubAgent).not.toHaveBeenCalled();
  });

  it('keeps the create-flow fallback message when no target block is provided', async () => {
    const result = await executeAgentTool(
      createOptions({htmlAppBlocksEnabled: false}),
      {},
    );

    expect(result).toMatchObject({
      success: true,
      finalOutput: 'Worksheet created successfully.',
    });
  });
});
