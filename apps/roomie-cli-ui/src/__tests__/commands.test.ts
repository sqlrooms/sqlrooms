import {describe, expect, it, jest} from '@jest/globals';
import {
  blockDocumentBlockToNode,
  type BlockDocumentBlock,
} from '@sqlrooms/documents';
import type {RoomCommandExecutionContext} from '@sqlrooms/room-store';
import {makeQualifiedTableName} from '@sqlrooms/duckdb';
import {createRoomieCommands} from '../commands';
import {TableSettings, TableExplorersConfig} from '../model';
import type {RoomState} from '../RoomState';

function setup(documents: Record<string, BlockDocumentBlock[]> = {}) {
  const tables = TableExplorersConfig.parse({});
  const update = jest.fn(
    (id: string, settings: ReturnType<typeof TableSettings.parse>) => {
      tables.byId[id] = TableSettings.parse(settings);
    },
  );
  const state = {
    db: {
      currentDatabase: 'workspace',
      findTable: (name: string) =>
        name === 'events'
          ? {
              table: makeQualifiedTableName({
                database: 'workspace',
                schema: 'main',
                table: name,
              }),
              isView: false,
            }
          : undefined,
      sqlSelectToJson: jest.fn(async () => ({
        error: false,
        statements: [{node: {type: 'SELECT_NODE'}}],
      })),
    },
    blockDocuments: {
      config: {
        artifacts: Object.fromEntries(
          Object.entries(documents).map(([id, blocks]) => [
            id,
            {
              id,
              content: {
                type: 'doc',
                content: blocks.map(blockDocumentBlockToNode),
              },
            },
          ]),
        ),
      },
    },
    mosaicDashboard: {getDashboard: () => ({panels: []})},
    tableExplorers: {config: tables, update},
  } as unknown as RoomState;
  const context = {
    getState: () => state,
    store: {getState: () => state},
    invocation: {surface: 'unknown'},
  } as RoomCommandExecutionContext<RoomState>;
  const commands = createRoomieCommands({
    resolveLocalFile: async (input) => ({
      ...input,
      format: input.format ?? 'csv',
    }),
  });
  const get = (id: string) => {
    const command = commands.find((command) => command.id === id);
    if (!command) throw new Error(`Missing command ${id}`);
    return command;
  };
  const validate = async (id: string, input: unknown) => {
    const command = get(id);
    const parsed = command.inputSchema
      ? command.inputSchema.parse(input)
      : input;
    await command.validateInput?.(parsed, context);
    return parsed;
  };
  return {commands, get, context, validate, update, tables};
}

const tableBlock = (
  id: string,
  instance = 'table-instance',
): BlockDocumentBlock => ({
  id,
  type: 'statefulBlock',
  blockType: 'data-table',
  blockInstanceId: instance,
  ownership: 'owned',
});

describe('Roomie authoring commands', () => {
  it('exposes document creation and block commands without standalone artifact creation', () => {
    const ids = setup().commands.map((command) => command.id);
    expect(ids).toContain('block-document.create');
    expect(ids).toContain('block-document.create-stateful-block');
    expect(ids).toContain('data-table.configure');
    expect(ids).not.toContain('dashboard.create');
    expect(ids).not.toContain('html-app.create');
    expect(
      ids.some((id) => id.startsWith('map.') || id.startsWith('ai.')),
    ).toBe(false);
  });

  it('rejects unsupported blocks and chart types before command execution', async () => {
    const {validate} = setup();
    await expect(
      validate('block-document.create-stateful-block', {
        artifactId: 'document',
        blockType: 'map',
      }),
    ).rejects.toThrow();
    await expect(
      validate('block-document.create-chart-block', {
        artifactId: 'document',
        tableName: 'events',
        config: {chartType: 'future-chart', settings: {}},
      }),
    ).rejects.toThrow('Unsupported Roomie chart type');
    await expect(
      validate('block-document.create-chart-block', {
        artifactId: 'document',
        tableName: 'events',
        config: {chartType: 'histogram', settings: {field: 'value'}},
      }),
    ).resolves.toBeDefined();
    await expect(
      validate('block-document.create', {
        blocks: [{...tableBlock('map'), blockType: 'map'}],
      }),
    ).rejects.toThrow();
  });

  it('rejects arbitrary custom specs and unverified chart sources before authoring', async () => {
    const {validate} = setup();
    await expect(
      validate('block-document.create-chart-block', {
        artifactId: 'document',
        tableName: 'events',
        config: {
          chartType: 'custom-spec',
          settings: {
            vgPlotSpec: {data: {external: {file: '/tmp/private.csv'}}},
          },
        },
      }),
    ).rejects.toThrow('Unsupported Roomie chart type');
    await expect(
      validate('block-document.create-chart-block', {
        artifactId: 'document',
        tableName: "read_csv('/tmp/private.csv')",
        config: {chartType: 'histogram', settings: {field: 'value'}},
      }),
    ).rejects.toThrow('physical table');
    await expect(
      validate('block-document.create', {
        blocks: [{...tableBlock('table'), tableName: 'unverified-view'}],
      }),
    ).rejects.toThrow('physical table');
    await expect(
      validate('block-document.create', {
        blocks: [
          {
            id: 'paragraph',
            type: 'paragraph',
            text: [
              blockDocumentBlockToNode({
                id: 'nested-chart',
                type: 'chart',
                tableName: 'unverified-view',
                config: {chartType: 'histogram', settings: {field: 'value'}},
              }),
            ],
          },
        ],
      }),
    ).rejects.toThrow('physical table');
  });

  it('rejects unknown rich text nodes without rejecting ordinary formatted text', async () => {
    const {validate} = setup();
    await expect(
      validate('block-document.create', {
        blocks: [
          {
            id: 'paragraph',
            type: 'paragraph',
            text: [{type: 'futureInline', text: 'keep me'}],
          },
        ],
      }),
    ).rejects.toThrow('Unsupported document node');
    await expect(
      validate('block-document.create', {
        blocks: [
          {
            id: 'paragraph',
            type: 'paragraph',
            text: [{type: 'text', text: 'Readable', marks: [{type: 'bold'}]}],
          },
        ],
      }),
    ).resolves.toBeDefined();
  });

  it('rejects referenced or previously owned backing instances', async () => {
    const {validate} = setup({first: [tableBlock('existing')]});
    await expect(
      validate('block-document.create-stateful-block', {
        artifactId: 'second',
        blockType: 'data-table',
        ownership: 'referenced',
      }),
    ).rejects.toThrow();
    await expect(
      validate('block-document.create-stateful-block', {
        artifactId: 'second',
        blockType: 'data-table',
        blockInstanceId: 'table-instance',
      }),
    ).rejects.toThrow();
  });

  it('rejects duplicate instances within a single incoming batch', async () => {
    const {validate} = setup();
    await expect(
      validate('block-document.create', {
        blocks: [tableBlock('one'), tableBlock('two')],
      }),
    ).rejects.toThrow();
  });

  it('uses the owning document as well as the local block ID when replacing a block', async () => {
    const {validate} = setup({
      first: [tableBlock('same-local-id', 'first-instance')],
      second: [tableBlock('same-local-id', 'second-instance')],
    });
    await expect(
      validate('block-document.update-block', {
        artifactId: 'second',
        blockId: 'same-local-id',
        block: tableBlock('same-local-id', 'first-instance'),
      }),
    ).rejects.toThrow();
    await expect(
      validate('block-document.update-block', {
        artifactId: 'second',
        blockId: 'same-local-id',
        block: tableBlock('same-local-id', 'second-instance'),
      }),
    ).resolves.toBeDefined();
  });

  it('restricts dashboard mutations to document blocks and supported panels', async () => {
    const {validate} = setup({
      document: [
        {
          id: 'dashboard-block',
          type: 'statefulBlock',
          blockType: 'dashboard',
          blockInstanceId: 'dashboard',
          ownership: 'owned',
        },
      ],
    });
    await expect(
      validate('dashboard.add-panel', {
        dashboardId: 'foreign',
        panel: {
          id: 'one',
          type: 'data-table-explorer',
          title: 'Table',
          config: {},
        },
      }),
    ).rejects.toThrow();
    await expect(
      validate('dashboard.add-panel', {
        dashboardId: 'dashboard',
        panel: {id: 'one', type: 'map', title: 'Map', config: {}},
      }),
    ).rejects.toThrow();
    await expect(
      validate('dashboard.add-panel', {
        dashboardId: 'dashboard',
        panel: {
          id: 'one',
          type: 'vgplot',
          title: 'Chart',
          config: {chartType: 'future-chart', settings: {}},
        },
      }),
    ).rejects.toThrow();
  });

  it('persists table preferences only for an owned document table', async () => {
    const {get, context, validate, tables, update} = setup({
      document: [tableBlock('table')],
    });
    const command = get('data-table.configure');
    const input = {
      blockInstanceId: 'table-instance',
      settings: {
        filters: ['"value" >= 10'],
        columns: ['city', 'value'],
        sorting: [{id: 'value', desc: true}],
        pageSize: 50,
      },
    };
    await command.execute(context, await validate(command.id, input));
    expect(
      TableExplorersConfig.parse(JSON.parse(JSON.stringify(tables))).byId[
        'table-instance'
      ],
    ).toEqual(input.settings);
    expect(() =>
      command.execute(context, {...input, blockInstanceId: 'foreign'}),
    ).toThrow('Unknown document table block');
    expect(update).toHaveBeenCalledTimes(1);
  });
});
