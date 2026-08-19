import {jest} from '@jest/globals';
import {tool, type Tool} from 'ai';
import type {
  BlockDocumentAiAdapter,
  BlockDocumentBlock,
  BlockDocumentMoveBlockAiAdapter,
  BlockDocumentNode,
  BlockDocumentStatefulBlockBlock,
} from '@sqlrooms/documents';
import {blockDocumentBlockToNode} from '@sqlrooms/documents';
import {makeQualifiedTableName} from '@sqlrooms/duckdb';
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
      findTable: (tableName) =>
        ({
          tableName: String(tableName),
          table: makeQualifiedTableName({
            schema: 'main',
            table: String(tableName),
          }),
          columns: [{name: 'magnitude', type: 'DOUBLE'}],
        }) as any,
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
          tableName,
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

  it('omits dashboard and data-table tools for a worksheet charts/maps profile', () => {
    const directMapTool = tool({
      description: 'mock direct map tool',
      inputSchema: {} as any,
      execute: async () => ({success: true}),
    });
    const tools = createCliBlockDocumentAiTools({
      ...createOptions(),
      chartToolsOptions: {},
      dashboardBlocksEnabled: false,
      dataTableBlocksEnabled: false,
      extraTools: () => ({
        [KnownBlockDocumentTools.create_block_document_map_block]:
          directMapTool,
      }),
    });

    expect(tools[KnownBlockDocumentTools.add_dashboard_block]).toBeUndefined();
    expect(
      tools[KnownBlockDocumentTools.embedded_dashboard_agent],
    ).toBeUndefined();
    expect(
      tools[KnownBlockDocumentTools.add_data_table_explorer],
    ).toBeUndefined();
    expect(tools[KnownBlockDocumentTools.create_block_document_map_block]).toBe(
      directMapTool,
    );
    expect(Object.keys(tools).some((name) => name.includes('chart'))).toBe(
      true,
    );
  });

  it('creates and updates worksheet charts deterministically', async () => {
    let currentBlocks: BlockDocumentNode[] = [];
    const addBlock = jest.fn(
      (_documentId: string, block: BlockDocumentBlock) => block.id,
    );
    const updateBlock = jest.fn(
      (_documentId: string, _blockId: string, _block: BlockDocumentBlock) => {},
    );
    const blockDocumentAdapter: BlockDocumentAiAdapter &
      BlockDocumentMoveBlockAiAdapter = {
      ...createBlockDocumentAdapter(),
      getBlocks: () => currentBlocks,
      addBlock,
      updateBlock,
    };
    const createTools = createCliBlockDocumentAiTools({
      ...createOptions({blockDocumentAdapter}),
      chartToolsOptions: {},
      dashboardBlocksEnabled: false,
      dataTableBlocksEnabled: false,
    });
    const histogram = createTools.create_block_document_chart_histogram as any;
    const created = await histogram.execute({
      tableName: 'earthquakes',
      title: 'Magnitude Distribution',
      settings: {field: 'magnitude'},
    });

    expect(created).toMatchObject({success: true});
    expect(addBlock).toHaveBeenCalledWith(
      'worksheet-1',
      expect.objectContaining({type: 'chart'}),
    );

    const existingBlock = (addBlock.mock.calls[0] as any)[1];
    currentBlocks = [blockDocumentBlockToNode(existingBlock)];
    const updateTools = createCliBlockDocumentAiTools({
      ...createOptions({blockDocumentAdapter}),
      chartToolsOptions: {},
      targetBlockId: existingBlock.id,
      dashboardBlocksEnabled: false,
      dataTableBlocksEnabled: false,
    });
    const updated = await (
      updateTools.create_block_document_chart_histogram as any
    ).execute({
      tableName: 'earthquakes',
      title: 'Updated Magnitude Distribution',
      settings: {field: 'magnitude'},
    });

    expect(updated).toMatchObject({success: true});
    expect(updateBlock).toHaveBeenCalledWith(
      'worksheet-1',
      existingBlock.id,
      expect.objectContaining({caption: 'Updated Magnitude Distribution'}),
    );
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
