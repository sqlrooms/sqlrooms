import {jest} from '@jest/globals';
import {
  BLOCK_DOCUMENT_CHART_TOOL_PREFIX,
  createAddMosaicDashboardBlockTool,
  createBlockDocumentChartTools,
  createBlockDocumentDataTableExplorerTool,
  type DatabaseAiAdapter,
} from '../src/ai';
import type {
  BlockDocumentAiAdapter,
  BlockDocumentBlock,
  BlockDocumentStatefulBlockBlock,
} from '@sqlrooms/documents';
import {makeQualifiedTableName} from '@sqlrooms/db';

describe('Mosaic block-document AI tools', () => {
  function createMockDatabaseAdapter(): DatabaseAiAdapter {
    return {
      getTables: () => [],
      findTable: (tableName) => ({
        tableName: String(tableName),
        table: makeQualifiedTableName({
          schema: 'main',
          table: String(tableName),
        }),
        columns: [
          {name: 'Depth', type: 'DOUBLE'},
          {name: 'magnitude', type: 'DOUBLE'},
        ],
      }),
    };
  }

  function createMockBlockDocumentAdapter() {
    const addedBlocks: BlockDocumentBlock[] = [];
    const blockDocumentAdapter: BlockDocumentAiAdapter = {
      setCurrentBlockDocument: () => {},
      ensureBlockDocument: () => {},
      getBlocks: () => [],
      addBlock: (_blockDocumentId, block) => {
        addedBlocks.push(block);
        return block.id;
      },
    };

    return {blockDocumentAdapter, addedBlocks};
  }

  it('uses block-document chart tool names', () => {
    expect(BLOCK_DOCUMENT_CHART_TOOL_PREFIX).toBe(
      'create_block_document_chart_',
    );
  });

  it('updates a chart block when a block-document chart tool receives panelId', async () => {
    const updateBlock = jest.fn();
    const addBlock = jest.fn((_blockDocumentId, block: BlockDocumentBlock) => {
      return block.id;
    });
    const blockDocumentAdapter: BlockDocumentAiAdapter = {
      setCurrentBlockDocument: () => {},
      ensureBlockDocument: () => {},
      getBlocks: () => [
        {
          type: 'chart',
          id: 'chart-block-1',
          tableName: 'earthquakes',
          caption: 'Magnitude histogram',
          config: {
            chartType: 'histogram',
            settings: {field: 'magnitude'},
          },
        },
      ],
      addBlock,
      updateBlock,
    };

    const tools = createBlockDocumentChartTools({
      databaseAdapter: createMockDatabaseAdapter(),
      blockDocumentAdapter,
      blockDocumentId: 'document-1',
    });

    const result = await (
      tools.create_block_document_chart_histogram as any
    ).execute({
      tableName: 'earthquakes',
      panelId: 'chart-block-1',
      title: 'Depth histogram',
      settings: {field: 'Depth'},
      reasoning: 'Update the existing worksheet chart block.',
    });

    expect(result.success).toBe(true);
    expect(addBlock).not.toHaveBeenCalled();
    expect(updateBlock).toHaveBeenCalledWith('document-1', 'chart-block-1', {
      type: 'chart',
      id: 'chart-block-1',
      tableName: '"main"."earthquakes"',
      caption: 'Depth histogram',
      config: {
        chartType: 'histogram',
        settings: {field: 'Depth'},
      },
    });
  });

  it('returns an error when panelId references a missing chart block', async () => {
    const updateBlock = jest.fn();
    const addBlock = jest.fn((_blockDocumentId, block: BlockDocumentBlock) => {
      return block.id;
    });
    const blockDocumentAdapter: BlockDocumentAiAdapter = {
      setCurrentBlockDocument: () => {},
      ensureBlockDocument: () => {},
      getBlocks: () => [],
      addBlock,
      updateBlock,
    };

    const tools = createBlockDocumentChartTools({
      databaseAdapter: createMockDatabaseAdapter(),
      blockDocumentAdapter,
      blockDocumentId: 'document-1',
    });

    const result = await (
      tools.create_block_document_chart_histogram as any
    ).execute({
      tableName: 'earthquakes',
      panelId: 'missing-chart-block',
      title: 'Depth histogram',
      settings: {field: 'Depth'},
      reasoning: 'Update the existing worksheet chart block.',
    });

    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain(
      'Chart block "missing-chart-block" was not found.',
    );
    expect(addBlock).not.toHaveBeenCalled();
    expect(updateBlock).not.toHaveBeenCalled();
  });

  it('adds Mosaic dashboard blocks through a host callback', async () => {
    const {blockDocumentAdapter, addedBlocks} =
      createMockBlockDocumentAdapter();
    const ensureBlockDocument = jest.spyOn(
      blockDocumentAdapter,
      'ensureBlockDocument',
    );
    const createDashboardBlock = jest.fn(
      ({
        title,
        intent,
      }: {
        title: string;
        tableName: string;
        intent?: string;
      }) => ({
        dashboardId: 'dashboard-1',
        block: {
          type: 'statefulBlock',
          id: 'dashboard-block-1',
          blockType: 'dashboard',
          blockInstanceId: 'dashboard-1',
          caption: title,
          intent,
        } satisfies BlockDocumentStatefulBlockBlock,
      }),
    );

    const tool = createAddMosaicDashboardBlockTool({
      blockDocumentAdapter,
      blockDocumentId: 'document-1',
      createDashboardBlock,
    });

    const result = await (tool as any).execute({
      reasoning: 'Create an interactive dashboard.',
      dashboardTitle: 'Earthquakes',
      tableName: 'earthquakes',
      intent: 'Explore earthquake distribution.',
    });

    expect(result).toEqual({
      success: true,
      dashboardId: 'dashboard-1',
      blockId: 'dashboard-block-1',
      message: 'Added Mosaic dashboard block to block document',
    });
    expect(ensureBlockDocument).toHaveBeenCalledWith('document-1');
    expect(createDashboardBlock).toHaveBeenCalledWith({
      title: 'Earthquakes',
      tableName: 'earthquakes',
      intent: 'Explore earthquake distribution.',
    });
    expect(addedBlocks).toEqual([
      expect.objectContaining({
        type: 'statefulBlock',
        blockType: 'dashboard',
        blockInstanceId: 'dashboard-1',
      }),
    ]);
  });

  it('validates the block document before creating dashboard state', async () => {
    const createDashboardBlock = jest.fn(() => ({
      dashboardId: 'dashboard-1',
      block: {
        type: 'statefulBlock',
        id: 'dashboard-block-1',
        blockType: 'dashboard',
        blockInstanceId: 'dashboard-1',
      } satisfies BlockDocumentStatefulBlockBlock,
    }));
    const blockDocumentAdapter: BlockDocumentAiAdapter = {
      setCurrentBlockDocument: () => {},
      ensureBlockDocument: () => {
        throw new Error('Block document was deleted');
      },
      getBlocks: () => [],
      addBlock: jest.fn((_blockDocumentId, block) => block.id),
    };

    const tool = createAddMosaicDashboardBlockTool({
      blockDocumentAdapter,
      blockDocumentId: 'missing-document',
      createDashboardBlock,
    });

    const result = await (tool as any).execute({
      reasoning: 'Create an interactive dashboard.',
      dashboardTitle: 'Earthquakes',
      tableName: 'earthquakes',
    });

    expect(result).toEqual({
      success: false,
      errorMessage: 'Block document was deleted',
    });
    expect(createDashboardBlock).not.toHaveBeenCalled();
    expect(blockDocumentAdapter.addBlock).not.toHaveBeenCalled();
  });

  it('adds data-table explorer blocks through a host callback', async () => {
    const {blockDocumentAdapter, addedBlocks} =
      createMockBlockDocumentAdapter();
    const ensureBlockDocument = jest.spyOn(
      blockDocumentAdapter,
      'ensureBlockDocument',
    );

    const dataTableTool = createBlockDocumentDataTableExplorerTool({
      databaseAdapter: createMockDatabaseAdapter(),
      blockDocumentAdapter,
      blockDocumentId: 'document-1',
      createDataTableExplorerBlock: ({title, tableName, intent}) => ({
        type: 'statefulBlock',
        id: 'table-block-1',
        blockType: 'data-table',
        blockInstanceId: 'table-instance-1',
        title: tableName,
        caption: title,
        intent,
      }),
    });

    const result = await (dataTableTool as any).execute({
      reasoning: 'The user asked to inspect rows.',
      title: 'Earthquake Rows',
      tableName: 'earthquakes',
      intent: 'Review raw earthquake data.',
    });

    expect(result.llmResult).toEqual(expect.objectContaining({success: true}));
    expect(ensureBlockDocument).toHaveBeenCalledWith('document-1');
    expect(addedBlocks).toEqual([
      expect.objectContaining({
        type: 'statefulBlock',
        blockType: 'data-table',
        blockInstanceId: 'table-instance-1',
        title: '"main"."earthquakes"',
        caption: 'Earthquake Rows',
      }),
    ]);
  });

  it('validates the block document before creating data-table explorer state', async () => {
    const createDataTableExplorerBlock = jest.fn(
      ({
        title,
        tableName,
        intent,
      }: {
        title: string;
        tableName: string;
        intent?: string;
      }) => ({
        type: 'statefulBlock',
        id: 'table-block-1',
        blockType: 'data-table',
        blockInstanceId: 'table-instance-1',
        title: tableName,
        caption: title,
        intent,
      }),
    );
    const blockDocumentAdapter: BlockDocumentAiAdapter = {
      setCurrentBlockDocument: () => {},
      ensureBlockDocument: () => {
        throw new Error('Block document was deleted');
      },
      getBlocks: () => [],
      addBlock: jest.fn((_blockDocumentId, block) => block.id),
    };

    const dataTableTool = createBlockDocumentDataTableExplorerTool({
      databaseAdapter: createMockDatabaseAdapter(),
      blockDocumentAdapter,
      blockDocumentId: 'missing-document',
      createDataTableExplorerBlock,
    });

    const result = await (dataTableTool as any).execute({
      reasoning: 'The user asked to inspect rows.',
      title: 'Earthquake Rows',
      tableName: 'earthquakes',
    });

    expect(result.llmResult).toEqual({
      success: false,
      errorMessage: 'Block document was deleted',
    });
    expect(createDataTableExplorerBlock).not.toHaveBeenCalled();
    expect(blockDocumentAdapter.addBlock).not.toHaveBeenCalled();
  });
});
