import {jest} from '@jest/globals';
import {tool, type Tool} from 'ai';
import type {
  BlockDocumentAiAdapter,
  BlockDocumentMoveBlockAiAdapter,
  BlockDocumentStatefulBlockBlock,
} from '@sqlrooms/documents';
import type {DatabaseAiAdapter} from '@sqlrooms/mosaic/ai';
import {createCliBlockDocumentAiTools} from '../createCliBlockDocumentAiTools';
import {KnownBlockDocumentTools} from '../constants';

describe('createCliBlockDocumentAiTools', () => {
  function createBlockDocumentAdapter(): BlockDocumentAiAdapter &
    BlockDocumentMoveBlockAiAdapter {
    return {
      setCurrentBlockDocument: () => {},
      ensureBlockDocument: () => {},
      getBlocks: () => [],
      addBlock: (_blockDocumentId, block) => block.id,
      moveBlock: () => true,
    };
  }

  function createDatabaseAdapter(): DatabaseAiAdapter {
    return {
      getTables: () => [],
      findTable: (tableName) => ({tableName: String(tableName)}) as any,
    };
  }

  function createOptions(
    overrides: {
      blockDocumentAdapter?: BlockDocumentAiAdapter &
        BlockDocumentMoveBlockAiAdapter;
      extraTools?: () => Record<string, Tool>;
      htmlAppBlocksEnabled?: boolean;
    } = {},
  ) {
    return {
      databaseAdapter: createDatabaseAdapter(),
      blockDocumentAdapter: createBlockDocumentAdapter(),
      dashboardAgentTool: tool({
        description: 'mock dashboard agent',
        inputSchema: {} as any,
        execute: async () => ({success: true}),
      }),
      chartToolsOptions: {chartTypes: []},
      blockDocumentId: 'worksheet-1',
      createDashboardBlock: ({title}: {title: string}) => ({
        dashboardId: 'dashboard-1',
        block: {
          type: 'statefulBlock',
          id: 'dashboard-block-1',
          blockType: 'dashboard',
          blockInstanceId: 'dashboard-1',
          caption: title,
        } satisfies BlockDocumentStatefulBlockBlock,
      }),
      createDataTableExplorerBlock: ({
        title,
        tableName,
      }: {
        title: string;
        tableName: string;
      }) =>
        ({
          type: 'statefulBlock',
          id: 'table-block-1',
          blockType: 'data-table',
          blockInstanceId: 'table-instance-1',
          title: tableName,
          caption: title,
        }) satisfies BlockDocumentStatefulBlockBlock,
      ...overrides,
    };
  }

  it('does not register HTML app block tools by default', () => {
    const tools = createCliBlockDocumentAiTools(createOptions());

    expect(tools[KnownBlockDocumentTools.add_html_app_block]).toBeUndefined();
    expect(
      tools[KnownBlockDocumentTools.embedded_html_app_agent],
    ).toBeUndefined();
  });

  it('registers a built-in block document block move tool', async () => {
    const blockDocumentAdapter = createBlockDocumentAdapter();
    const moveBlock = jest.spyOn(blockDocumentAdapter, 'moveBlock');
    const tools = createCliBlockDocumentAiTools(
      createOptions({blockDocumentAdapter}),
    );

    expect(tools[KnownBlockDocumentTools.move_block]).toBeDefined();

    const result = await (
      tools[KnownBlockDocumentTools.move_block] as any
    ).execute({
      blockId: 'paragraph-1',
      toIndex: 0,
    });

    expect(result).toEqual({
      success: true,
      blockId: 'paragraph-1',
      toIndex: 0,
      message: 'Moved block paragraph-1 to index 0',
    });
    expect(moveBlock).toHaveBeenCalledWith('worksheet-1', 'paragraph-1', 0);
  });

  it('rejects HTML app block tools when the embedded app agent is unavailable', () => {
    expect(() =>
      createCliBlockDocumentAiTools(
        createOptions({htmlAppBlocksEnabled: true}),
      ),
    ).toThrow(
      'add_html_app_block requires embedded_html_app_agent in extraTools when htmlAppBlocksEnabled is true.',
    );
  });

  it('registers HTML app block tools when the embedded app agent is available', () => {
    const embeddedHtmlAppAgent = tool({
      description: 'mock embedded html app agent',
      inputSchema: {} as any,
      execute: async () => ({success: true}),
    });

    const tools = createCliBlockDocumentAiTools(
      createOptions({
        htmlAppBlocksEnabled: true,
        extraTools: jest.fn(() => ({
          [KnownBlockDocumentTools.embedded_html_app_agent]:
            embeddedHtmlAppAgent,
        })),
      }),
    );

    expect(tools[KnownBlockDocumentTools.add_html_app_block]).toBeDefined();
    expect(tools[KnownBlockDocumentTools.embedded_html_app_agent]).toBe(
      embeddedHtmlAppAgent,
    );
  });
});
