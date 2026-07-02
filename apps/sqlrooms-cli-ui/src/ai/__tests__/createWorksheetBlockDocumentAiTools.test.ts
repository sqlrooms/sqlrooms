import {jest} from '@jest/globals';
import {tool, type Tool} from 'ai';
import type {
  BlockDocumentAiAdapter,
  BlockDocumentStatefulBlockBlock,
} from '@sqlrooms/documents';
import type {DatabaseAiAdapter} from '@sqlrooms/mosaic/ai';
import {createWorksheetBlockDocumentAiTools} from '../createWorksheetBlockDocumentAiTools';
import {KnownWorksheetTools} from '../constants';

describe('createWorksheetBlockDocumentAiTools', () => {
  function createBlockDocumentAdapter(): BlockDocumentAiAdapter {
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
      blockDocumentAdapter?: BlockDocumentAiAdapter;
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
      worksheetId: 'worksheet-1',
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
    const tools = createWorksheetBlockDocumentAiTools(createOptions());

    expect(tools[KnownWorksheetTools.add_html_app_block]).toBeUndefined();
    expect(tools[KnownWorksheetTools.embedded_html_app_agent]).toBeUndefined();
  });

  it('registers a built-in worksheet block move tool', async () => {
    const blockDocumentAdapter = createBlockDocumentAdapter();
    const moveBlock = jest.spyOn(blockDocumentAdapter, 'moveBlock');
    const tools = createWorksheetBlockDocumentAiTools(
      createOptions({blockDocumentAdapter}),
    );

    expect(tools[KnownWorksheetTools.move_block]).toBeDefined();

    const result = await (tools[KnownWorksheetTools.move_block] as any).execute(
      {
        blockId: 'paragraph-1',
        toIndex: 0,
      },
    );

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
      createWorksheetBlockDocumentAiTools(
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

    const tools = createWorksheetBlockDocumentAiTools(
      createOptions({
        htmlAppBlocksEnabled: true,
        extraTools: jest.fn(() => ({
          [KnownWorksheetTools.embedded_html_app_agent]: embeddedHtmlAppAgent,
        })),
      }),
    );

    expect(tools[KnownWorksheetTools.add_html_app_block]).toBeDefined();
    expect(tools[KnownWorksheetTools.embedded_html_app_agent]).toBe(
      embeddedHtmlAppAgent,
    );
  });
});
