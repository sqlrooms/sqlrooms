import {jest} from '@jest/globals';
import {DECK_MAP_DASHBOARD_PANEL_TYPE} from '@sqlrooms/deck';
import type {MosaicDashboardPanelConfigType} from '@sqlrooms/mosaic';
import {createWorksheetCommands} from '../createWorksheetCommands';

function createCommandContext(state: unknown) {
  return {
    getState: () => state as any,
    store: {getState: () => state} as any,
    invocation: {surface: 'unknown' as const},
  };
}

function getCommand(id: string) {
  const command = createWorksheetCommands().find(
    (candidate) => candidate.id === id,
  );
  if (!command) {
    throw new Error(`Missing command "${id}".`);
  }
  return command;
}

function createState() {
  const blocks: any[] = [
    {
      id: 'block-1',
      type: 'statefulBlock',
      blockType: 'map',
      blockInstanceId: 'map-1',
      title: 'Map',
    },
  ];
  const invokeCommand = jest.fn(async (commandId: string, input: any) => {
    if (commandId === 'worksheet.create-stateful-block') {
      return {
        success: true,
        commandId,
        data: {
          blockId: `${input.blockType}-block`,
          blockInstanceId: input.blockInstanceId ?? `${input.blockType}-id`,
        },
      };
    }
    if (commandId.startsWith('dashboard.')) {
      return {success: true, commandId, data: input};
    }
    return {success: true, commandId, data: input};
  });
  const updateBlock = jest.fn((worksheetId: string, blockId: string, block) => {
    const index = blocks.findIndex((candidate) => candidate.id === blockId);
    if (worksheetId !== 'worksheet-1' || index < 0) return false;
    blocks[index] = block;
    return true;
  });

  return {
    blocks,
    state: {
      commands: {invokeCommand},
      artifacts: {
        getArtifact: (artifactId: string) =>
          artifactId === 'worksheet-1'
            ? {id: artifactId, type: 'worksheet', title: 'Worksheet'}
            : undefined,
      },
      blockDocuments: {
        ensureBlockDocument: jest.fn(),
        getBlocks: () => blocks,
        updateBlock,
      },
      db: {
        findTable: (tableName: string) =>
          tableName === 'earthquakes' ? {tableName} : undefined,
      },
      mosaicDashboard: {
        ensureDashboard: jest.fn(),
        getDashboard: jest.fn(() => ({
          panels: [] as MosaicDashboardPanelConfigType[],
        })),
      },
    },
    invokeCommand,
    updateBlock,
  };
}

describe('createWorksheetCommands', () => {
  it('registers the Stage 5 worksheet command IDs', () => {
    expect(createWorksheetCommands().map((command) => command.id)).toEqual([
      'worksheet.add-dashboard-block',
      'worksheet.add-data-table-block',
      'worksheet.add-html-app-block',
      'worksheet.update-block-metadata',
      'worksheet.add-map-block',
    ]);
  });

  it('adds dashboard blocks through worksheet and dashboard commands', async () => {
    const {state, invokeCommand} = createState();
    const result = await getCommand('worksheet.add-dashboard-block').execute(
      createCommandContext(state),
      {
        worksheetId: 'worksheet-1',
        title: 'Dashboard',
        tableName: 'earthquakes',
        intent: 'show trends',
      },
    );

    expect(result).toMatchObject({
      success: true,
      data: {
        worksheetId: 'worksheet-1',
        blockId: 'dashboard-block',
        dashboardId: 'dashboard-id',
        selectedTable: 'earthquakes',
      },
    });
    expect(invokeCommand).toHaveBeenCalledWith(
      'worksheet.create-stateful-block',
      expect.objectContaining({
        artifactId: 'worksheet-1',
        blockType: 'dashboard',
        title: 'Dashboard',
      }),
      {surface: 'ai', actor: 'worksheet-command'},
    );
    expect(invokeCommand).toHaveBeenCalledWith(
      'dashboard.set-selected-table',
      {dashboardId: 'dashboard-id', tableName: 'earthquakes'},
      {surface: 'ai', actor: 'worksheet-command'},
    );
  });

  it('adds data table and HTML app blocks through worksheet commands', async () => {
    const {state} = createState();

    await expect(
      getCommand('worksheet.add-data-table-block').execute(
        createCommandContext(state),
        {
          worksheetId: 'worksheet-1',
          title: 'Profile',
          tableName: 'earthquakes',
        },
      ),
    ).resolves.toMatchObject({
      success: true,
      data: {blockId: 'data-table-block', dataTableId: 'data-table-id'},
    });

    await expect(
      getCommand('worksheet.add-html-app-block').execute(
        createCommandContext(state),
        {
          worksheetId: 'worksheet-1',
          title: 'Explorer App',
        },
      ),
    ).resolves.toMatchObject({
      success: true,
      data: {blockId: 'html-app-block', appId: 'html-app-id'},
    });
  });

  it('updates worksheet block metadata through the block document slice', async () => {
    const {state, updateBlock} = createState();

    const result = await getCommand('worksheet.update-block-metadata').execute(
      createCommandContext(state),
      {
        worksheetId: 'worksheet-1',
        blockId: 'block-1',
        title: 'Updated Map',
        caption: 'Updated Map',
      },
    );

    expect(result).toMatchObject({
      success: true,
      data: {
        worksheetId: 'worksheet-1',
        blockId: 'block-1',
        title: 'Updated Map',
        caption: 'Updated Map',
      },
    });
    expect(updateBlock).toHaveBeenCalledWith(
      'worksheet-1',
      'block-1',
      expect.objectContaining({
        id: 'block-1',
        title: 'Updated Map',
        caption: 'Updated Map',
      }),
    );
  });

  it('does not mutate dashboard state when map block creation fails', async () => {
    const {state, invokeCommand} = createState();
    invokeCommand.mockImplementation(async (commandId: string, input: any) => {
      if (
        commandId === 'worksheet.create-stateful-block' &&
        input.blockType === 'map'
      ) {
        return {
          success: false,
          commandId,
          error: 'Unsupported block type: map',
          data: undefined,
        };
      }
      if (commandId.startsWith('dashboard.')) {
        return {success: true, commandId, data: input};
      }
      return {success: true, commandId, data: input};
    });

    await expect(
      getCommand('worksheet.add-map-block').execute(
        createCommandContext(state),
        {
          worksheetId: 'worksheet-1',
          title: 'Map',
          reasoning: 'show earthquake points',
          config: {
            spec: {},
            datasets: {
              earthquakes: {source: {tableName: 'earthquakes'}},
            },
          },
        },
      ),
    ).rejects.toThrow('Unsupported block type: map');

    expect(state.mosaicDashboard.ensureDashboard).not.toHaveBeenCalled();
    expect(invokeCommand).not.toHaveBeenCalledWith(
      'dashboard.set-selected-table',
      expect.anything(),
      expect.anything(),
    );
    expect(invokeCommand).not.toHaveBeenCalledWith(
      'dashboard.add-panel',
      expect.anything(),
      expect.anything(),
    );
  });

  it('updates a map panel seeded by stateful block creation instead of adding a duplicate', async () => {
    const {state, invokeCommand} = createState();
    let mapStateSeeded = false;
    const seededPanel: MosaicDashboardPanelConfigType = {
      id: 'seeded-map-panel',
      type: DECK_MAP_DASHBOARD_PANEL_TYPE,
      title: 'Seeded Map',
      config: {},
    };
    state.mosaicDashboard.getDashboard.mockImplementation(() => ({
      panels: mapStateSeeded ? [seededPanel] : [],
    }));
    invokeCommand.mockImplementation(async (commandId: string, input: any) => {
      if (
        commandId === 'worksheet.create-stateful-block' &&
        input.blockType === 'map'
      ) {
        mapStateSeeded = true;
        return {
          success: true,
          commandId,
          data: {
            blockId: 'map-block',
            blockInstanceId: input.blockInstanceId,
          },
        };
      }
      if (commandId.startsWith('dashboard.')) {
        return {success: true, commandId, data: input};
      }
      return {success: true, commandId, data: input};
    });

    const result = await getCommand('worksheet.add-map-block').execute(
      createCommandContext(state),
      {
        worksheetId: 'worksheet-1',
        title: 'Map',
        reasoning: 'show earthquake points',
        config: {
          spec: {},
          datasets: {
            earthquakes: {source: {tableName: 'earthquakes'}},
          },
        },
      },
    );

    expect(result).toMatchObject({
      success: true,
      data: {blockId: 'map-block', panelId: 'seeded-map-panel'},
    });
    expect(invokeCommand).toHaveBeenCalledWith(
      'dashboard.update-panel',
      expect.objectContaining({
        panelId: 'seeded-map-panel',
      }),
      {surface: 'ai', actor: 'worksheet-command'},
    );
    expect(invokeCommand).not.toHaveBeenCalledWith(
      'dashboard.add-panel',
      expect.anything(),
      expect.anything(),
    );
  });
});
