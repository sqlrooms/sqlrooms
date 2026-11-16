import {
  createArtifactsSlice,
  defineArtifactTypes,
  type ArtifactsSliceState,
} from '@sqlrooms/artifacts';
import {
  createBaseRoomSlice,
  createCommandSlice,
  type BaseRoomStoreState,
  type CommandSliceState,
} from '@sqlrooms/room-store';
import {z} from 'zod';
import {createStore} from 'zustand';
import {
  createBlockDocumentCommands,
  createBlockDocumentsSlice,
  type BlockDocumentsSliceState,
} from '../src';

type TestRoomState = BaseRoomStoreState &
  ArtifactsSliceState &
  BlockDocumentsSliceState &
  CommandSliceState<any>;

function createTestStore({
  allowedBlockTypes,
  chartBlock,
  readState,
}: {
  readState?: (context: {
    state: TestRoomState;
    blockInstanceId: string;
  }) => unknown;
  allowedBlockTypes?: Parameters<
    typeof createBlockDocumentCommands<TestRoomState>
  >[0]['allowedBlockTypes'];
  chartBlock?: Parameters<
    typeof createBlockDocumentCommands<TestRoomState>
  >[0]['chartBlock'];
} = {}) {
  let timestamp = 100;
  const ensuredStatefulBlocks: Array<{id: string; title: string}> = [];
  const now = () => timestamp++;
  const artifactTypes = defineArtifactTypes({
    'block-document': {
      label: 'Block Document',
      defaultTitle: 'Block Document',
    },
    dashboard: {label: 'Dashboard', defaultTitle: 'Dashboard'},
    'markdown-document': {label: 'Markdown', defaultTitle: 'Markdown'},
  });

  const store = createStore<TestRoomState>()((...args) => ({
    ...createBaseRoomSlice()(...args),
    ...createCommandSlice<TestRoomState>()(...args),
    ...createArtifactsSlice({artifactTypes})(...args),
    ...createBlockDocumentsSlice<TestRoomState>({now})(...args),
  }));

  store.getState().commands.registerCommands(
    '@sqlrooms/documents/block-document',
    createBlockDocumentCommands<TestRoomState>({
      statefulBlockTypes: [
        {
          blockType: 'dashboard',
          readState,
          label: 'Dashboard',
          defaultTitle: 'Embedded Dashboard',
          ensureState: ({blockInstanceId, title}) => {
            ensuredStatefulBlocks.push({id: blockInstanceId, title});
          },
        },
      ],
      allowedBlockTypes,
      chartBlock,
    }),
  );
  return {store, ensuredStatefulBlocks};
}

/** The desktop's host-specific chart-block config shape. */
const VEGA_LITE_CHART_BLOCK_OPTIONS = {
  description:
    'Create a block document chart block from a Vega-Lite spec and the SQL that feeds it',
  configSchema: z
    .object({
      vegaLiteSpec: z.union([z.string(), z.record(z.string(), z.unknown())]),
      sqlQuery: z.string().optional(),
    })
    .loose()
    .describe('Document chart config: {vegaLiteSpec, sqlQuery}.'),
};

describe('block document commands', () => {
  it('inspects inline blocks and registered backing state without changing the document', async () => {
    const reads: string[] = [];
    const backingState = {title: 'Backing dashboard', charts: []};
    const {store, ensuredStatefulBlocks} = createTestStore({
      readState: ({blockInstanceId}) => {
        reads.push(blockInstanceId);
        return backingState;
      },
    });
    const artifactId = store
      .getState()
      .artifacts.createArtifact({type: 'block-document'});
    store.getState().blockDocuments.appendBlocks(artifactId, [
      {id: 'note', type: 'paragraph', text: [{type: 'text', text: 'A note'}]},
      {
        id: 'chart',
        type: 'chart',
        tableName: 'events',
        config: {title: 'Inline chart'},
      },
      {
        id: 'dashboard-block',
        type: 'statefulBlock',
        blockType: 'dashboard',
        blockInstanceId: 'backing-dashboard',
      },
    ]);
    const before = JSON.stringify(store.getState().blockDocuments.config);
    const blocks = store.getState().blockDocuments.getBlocks(artifactId);
    for (const block of blocks) {
      const result = await store
        .getState()
        .commands.invokeCommand('block-document.inspect-block', {
          artifactId,
          blockId: block.id,
        });
      expect(result).toMatchObject({success: true});
      expect(result.data).toEqual({
        artifactId,
        block,
        ...(block.type === 'statefulBlock' ? {backingState} : {}),
      });
    }
    expect(reads).toEqual(['backing-dashboard']);
    expect(ensuredStatefulBlocks).toEqual([]);
    expect(JSON.stringify(store.getState().blockDocuments.config)).toBe(before);
  });

  it('validates the explicit document and block before accessing backing state', async () => {
    const reads: string[] = [];
    const {store} = createTestStore({
      readState: ({blockInstanceId}) => {
        reads.push(blockInstanceId);
        return {};
      },
    });
    const artifactId = store
      .getState()
      .artifacts.createArtifact({type: 'block-document'});
    const otherId = store
      .getState()
      .artifacts.createArtifact({type: 'block-document'});
    const wrongType = store
      .getState()
      .artifacts.createArtifact({type: 'dashboard'});
    store.getState().blockDocuments.appendBlocks(otherId, [
      {
        id: 'other-block',
        type: 'statefulBlock',
        blockType: 'dashboard',
        blockInstanceId: 'backing-dashboard',
      },
    ]);
    const before = JSON.stringify(store.getState().blockDocuments.config);
    for (const input of [
      {},
      {artifactId, blockId: ''},
      {artifactId: '', blockId: 'other-block'},
      {artifactId: 'missing', blockId: 'other-block'},
      {artifactId: wrongType, blockId: 'other-block'},
      {artifactId, blockId: 'other-block'},
      {artifactId: otherId, blockId: 'backing-dashboard'},
    ]) {
      expect(
        await store
          .getState()
          .commands.invokeCommand('block-document.inspect-block', input),
      ).toMatchObject({success: false});
    }
    expect(reads).toEqual([]);
    expect(JSON.stringify(store.getState().blockDocuments.config)).toBe(before);
  });

  it('reports unsupported inspection and missing backing state explicitly', async () => {
    for (const readState of [undefined, () => undefined]) {
      const {store, ensuredStatefulBlocks} = createTestStore({readState});
      const artifactId = store
        .getState()
        .artifacts.createArtifact({type: 'block-document'});
      store.getState().blockDocuments.appendBlocks(artifactId, [
        {
          id: 'dashboard-block',
          type: 'statefulBlock',
          blockType: 'dashboard',
          blockInstanceId: 'missing',
        },
        {
          id: 'unregistered-block',
          type: 'statefulBlock',
          blockType: 'unregistered',
          blockInstanceId: 'missing',
        },
      ]);
      const before = JSON.stringify(store.getState().blockDocuments.config);
      for (const blockId of ['dashboard-block', 'unregistered-block']) {
        expect(
          await store
            .getState()
            .commands.invokeCommand('block-document.inspect-block', {
              artifactId,
              blockId,
            }),
        ).toMatchObject({
          success: false,
          error: expect.stringContaining(
            readState && blockId === 'dashboard-block'
              ? 'was not found'
              : 'not supported',
          ),
        });
      }
      expect(ensuredStatefulBlocks).toEqual([]);
      expect(JSON.stringify(store.getState().blockDocuments.config)).toBe(
        before,
      );
    }
  });

  it('creates, lists, and reads block document artifacts', async () => {
    const {store} = createTestStore();

    const createResult = await store
      .getState()
      .commands.invokeCommand('block-document.create', {
        title: 'Findings',
        blocks: [
          {
            id: 'heading',
            type: 'heading',
            level: 1,
            text: [{type: 'text', text: 'Findings'}],
          },
        ],
      });

    expect(createResult.success).toBe(true);
    const artifactId = (createResult.data as any).artifactId as string;
    expect(store.getState().artifacts.getArtifact(artifactId)).toMatchObject({
      id: artifactId,
      type: 'block-document',
      title: 'Findings',
    });
    expect(store.getState().blockDocuments.getBlocks(artifactId)).toEqual([
      {
        id: 'heading',
        type: 'heading',
        level: 1,
        text: [{type: 'text', text: 'Findings'}],
      },
    ]);

    const listResult = await store
      .getState()
      .commands.invokeCommand('block-document.list');
    expect((listResult.data as any).documents).toEqual([
      {
        artifactId,
        title: 'Findings',
        updatedAt: 101,
        blockCount: 1,
        assetCount: 0,
      },
    ]);

    const getResult = await store
      .getState()
      .commands.invokeCommand('block-document.get', {artifactId});
    expect(getResult.data).toMatchObject({
      artifactId,
      title: 'Findings',
      blocks: [
        {
          id: 'heading',
          type: 'heading',
          level: 1,
          text: [{type: 'text', text: 'Findings'}],
        },
      ],
      assets: [],
      updatedAt: 101,
    });
  });

  it('reads the AI invocation target when the live document changes', async () => {
    const {store} = createTestStore();
    const artifactA = store.getState().artifacts.createArtifact({
      type: 'block-document',
      title: 'Document A',
    });
    store.getState().blockDocuments.ensureBlockDocument(artifactA);
    const artifactB = store.getState().artifacts.createArtifact({
      type: 'block-document',
      title: 'Document B',
    });
    store.getState().blockDocuments.ensureBlockDocument(artifactB);

    const result = await store.getState().commands.invokeCommand(
      'block-document.get',
      {},
      {
        surface: 'ai',
        target: {kind: 'artifact', id: artifactA},
      },
    );

    expect(result.data).toMatchObject({artifactId: artifactA});
    expect(store.getState().artifacts.config.currentArtifactId).toBe(artifactB);
  });

  it('mutates block document blocks by command', async () => {
    const {store} = createTestStore();
    const createResult = await store
      .getState()
      .commands.invokeCommand('block-document.create');
    const artifactId = (createResult.data as any).artifactId as string;

    const appendResult = await store
      .getState()
      .commands.invokeCommand('block-document.append-blocks', {
        artifactId,
        blocks: [
          {id: 'p1', type: 'paragraph', text: [{type: 'text', text: 'First'}]},
        ],
      });
    expect(appendResult.data).toMatchObject({
      artifactId,
      blockId: 'p1',
      blockType: 'paragraph',
      blockIds: ['p1'],
      blockTypes: ['paragraph'],
      affectedBlocks: [
        {id: 'p1', type: 'paragraph', text: [{type: 'text', text: 'First'}]},
      ],
    });
    await store
      .getState()
      .commands.invokeCommand('block-document.insert-blocks', {
        artifactId,
        index: 0,
        blocks: [
          {
            id: 'h1',
            type: 'heading',
            level: 2,
            text: [{type: 'text', text: 'Overview'}],
          },
        ],
      });
    const updateResult = await store
      .getState()
      .commands.invokeCommand('block-document.update-block', {
        artifactId,
        blockId: 'p1',
        block: {
          id: 'ignored',
          type: 'paragraph',
          text: [{type: 'text', text: 'Updated'}],
        },
      });
    expect(updateResult.data).toMatchObject({
      artifactId,
      blockId: 'p1',
      blockType: 'paragraph',
      blockIds: ['p1'],
      blockTypes: ['paragraph'],
      affectedBlocks: [
        {id: 'p1', type: 'paragraph', text: [{type: 'text', text: 'Updated'}]},
      ],
    });
    await store.getState().commands.invokeCommand('block-document.move-block', {
      artifactId,
      blockId: 'p1',
      toIndex: 0,
    });
    await store
      .getState()
      .commands.invokeCommand('block-document.remove-block', {
        artifactId,
        blockId: 'h1',
      });

    expect(store.getState().blockDocuments.getBlocks(artifactId)).toEqual([
      {id: 'p1', type: 'paragraph', text: [{type: 'text', text: 'Updated'}]},
    ]);
  });

  it('creates chart blocks', async () => {
    const {store} = createTestStore();
    const createResult = await store
      .getState()
      .commands.invokeCommand('block-document.create');
    const artifactId = (createResult.data as any).artifactId as string;

    const chartResult = await store
      .getState()
      .commands.invokeCommand('block-document.create-chart-block', {
        artifactId,
        blockId: 'chart-1',
        intent: 'Show the revenue distribution for the sales review.',
        tableName: 'sales',
        config: {chartType: 'histogram', settings: {field: 'revenue'}},
        selectionGroupId: 'overview',
        caption: 'Revenue',
      });
    expect(chartResult.data).toMatchObject({
      artifactId,
      blockId: 'chart-1',
      blockType: 'chart',
      tableName: 'sales',
      selectionGroupId: 'overview',
      caption: 'Revenue',
    });
    expect(store.getState().blockDocuments.getBlocks(artifactId)).toEqual([
      {
        id: 'chart-1',
        type: 'chart',
        intent: 'Show the revenue distribution for the sales review.',
        tableName: 'sales',
        config: {chartType: 'histogram', settings: {field: 'revenue'}},
        selectionGroupId: 'overview',
        caption: 'Revenue',
      },
    ]);
  });

  it('creates a Vega-Lite chart block without a table name', async () => {
    const {store} = createTestStore({
      chartBlock: VEGA_LITE_CHART_BLOCK_OPTIONS,
    });
    const createResult = await store
      .getState()
      .commands.invokeCommand('block-document.create');
    const artifactId = (createResult.data as any).artifactId as string;
    const config = {
      vegaLiteSpec: {
        mark: 'bar',
        encoding: {x: {field: 'decile', type: 'nominal'}},
      },
      sqlQuery: 'SELECT * FROM la_pop_deciles',
    };

    const chartResult = await store
      .getState()
      .commands.invokeCommand('block-document.create-chart-block', {
        artifactId,
        blockId: 'chart-vega',
        config,
        caption: 'Share by decile',
      });

    // A Vega-Lite config carries its own SQL, so the block must simply omit
    // `tableName` — storing `''` to mean "no table" is what every reader would
    // otherwise have to interpret.
    expect(chartResult.data).toMatchObject({
      artifactId,
      blockId: 'chart-vega',
      blockType: 'chart',
      caption: 'Share by decile',
    });
    expect(
      (chartResult.data as {tableName?: string}).tableName,
    ).toBeUndefined();
    expect(store.getState().blockDocuments.getBlocks(artifactId)).toEqual([
      {
        id: 'chart-vega',
        type: 'chart',
        config,
        caption: 'Share by decile',
      },
    ]);
  });

  it('rejects a config that does not match the host chart schema', async () => {
    const {store} = createTestStore({
      chartBlock: VEGA_LITE_CHART_BLOCK_OPTIONS,
    });
    const createResult = await store
      .getState()
      .commands.invokeCommand('block-document.create');
    const artifactId = (createResult.data as any).artifactId as string;

    const chartResult = await store
      .getState()
      .commands.invokeCommand('block-document.create-chart-block', {
        artifactId,
        config: {chartType: 'bar', settings: {x: 'decile', y: 'pop'}},
      });

    expect(chartResult.success).toBe(false);
    expect(JSON.stringify(chartResult)).toContain('vegaLiteSpec');
    expect(store.getState().blockDocuments.getBlocks(artifactId)).toEqual([]);
  });

  it('accepts a table-less chart block through the generic block commands', async () => {
    const {store} = createTestStore();
    const createResult = await store
      .getState()
      .commands.invokeCommand('block-document.create');
    const artifactId = (createResult.data as any).artifactId as string;
    const config = {vegaLiteSpec: {mark: 'bar'}, sqlQuery: 'SELECT 1'};

    // `tableName` is optional on the block schema itself, not just on
    // create-chart-block, so append/insert/update treat the same block the same.
    await expect(
      store.getState().commands.invokeCommand('block-document.append-blocks', {
        artifactId,
        blocks: [{id: 'chart-no-table', type: 'chart', config}],
      }),
    ).resolves.toMatchObject({success: true});

    expect(store.getState().blockDocuments.getBlocks(artifactId)).toEqual([
      {id: 'chart-no-table', type: 'chart', config},
    ]);
  });

  describe.each(['create', 'append-blocks', 'insert-blocks', 'update-block'])(
    'host chart config in %s',
    (suffix) => {
      function mutationInput(artifactId: string, config: unknown) {
        const block = {id: 'chart', type: 'chart', config};
        return suffix === 'update-block'
          ? {artifactId, blockId: block.id, block}
          : {artifactId, blocks: [block], index: 0};
      }

      it('rejects invalid configs without changing document state', async () => {
        const {store} = createTestStore({
          chartBlock: VEGA_LITE_CHART_BLOCK_OPTIONS,
        });
        const artifactId = store
          .getState()
          .artifacts.createArtifact({type: 'block-document'});
        store
          .getState()
          .blockDocuments.appendBlocks(artifactId, [
            {id: 'chart', type: 'chart', config: {vegaLiteSpec: {mark: 'bar'}}},
          ]);
        const before = JSON.stringify({
          artifacts: store.getState().artifacts.config,
          documents: store.getState().blockDocuments.config,
        });

        const result = await store
          .getState()
          .commands.invokeCommand(
            `block-document.${suffix}`,
            mutationInput(artifactId, {chartType: 'bar', settings: {}}),
          );

        expect(result.success).toBe(false);
        expect(JSON.stringify(result)).toContain('vegaLiteSpec');
        expect(JSON.stringify(result)).toContain(
          suffix === 'update-block'
            ? 'block.config.vegaLiteSpec'
            : 'blocks.0.config.vegaLiteSpec',
        );
        expect(
          JSON.stringify({
            artifacts: store.getState().artifacts.config,
            documents: store.getState().blockDocuments.config,
          }),
        ).toBe(before);
      });

      it.each(['object', 'JSON string'])(
        'saves the validated %s config, including schema defaults',
        async (inputFormat) => {
          const {store} = createTestStore({
            chartBlock: {
              configSchema: VEGA_LITE_CHART_BLOCK_OPTIONS.configSchema.extend({
                sqlQuery: z.string().default('SELECT 1'),
              }),
            },
          });
          const artifactId = store
            .getState()
            .artifacts.createArtifact({type: 'block-document'});
          if (suffix === 'update-block') {
            store
              .getState()
              .blockDocuments.appendBlocks(artifactId, [
                {id: 'chart', type: 'paragraph', text: []},
              ]);
          }
          const config = {vegaLiteSpec: {mark: 'bar'}};

          const result = await store
            .getState()
            .commands.invokeCommand(
              `block-document.${suffix}`,
              mutationInput(
                artifactId,
                inputFormat === 'JSON string' ? JSON.stringify(config) : config,
              ),
            );

          expect(result.success).toBe(true);
          const targetArtifactId =
            suffix === 'create'
              ? (result.data as {artifactId: string}).artifactId
              : artifactId;
          expect(
            store.getState().blockDocuments.getBlocks(targetArtifactId),
          ).toEqual([
            {
              id: 'chart',
              type: 'chart',
              config: {...config, sqlQuery: 'SELECT 1'},
            },
          ]);
        },
      );

      it('advertises the host chart shape in generic command discovery', () => {
        const {store} = createTestStore({
          chartBlock: VEGA_LITE_CHART_BLOCK_OPTIONS,
        });
        const descriptor = store
          .getState()
          .commands.listCommands({includeInputSchema: true})
          .find((command) => command.id === `block-document.${suffix}`);

        expect(JSON.stringify(descriptor?.inputSchema)).toContain(
          'vegaLiteSpec',
        );
      });
    },
  );

  it('advertises the Vega-Lite config shape when the host configures it', () => {
    const {store} = createTestStore({
      chartBlock: VEGA_LITE_CHART_BLOCK_OPTIONS,
    });
    const descriptor = store
      .getState()
      .commands.listCommands({includeInputSchema: true})
      .find((command) => command.id === 'block-document.create-chart-block');

    expect(descriptor?.description).toContain('Vega-Lite');
    expect(descriptor?.inputDescription).toContain('chart config');

    // The host's config schema is what command discovery advertises, so the
    // real shape — not just a description of it — reaches MCP clients.
    const inputSchema = descriptor?.inputSchema as
      | {
          properties?: {
            config?: {properties?: Record<string, unknown>};
            tableName?: unknown;
          };
          required?: string[];
        }
      | undefined;
    expect(inputSchema?.properties?.config?.properties).toHaveProperty(
      'vegaLiteSpec',
    );
    expect(inputSchema?.properties).toHaveProperty('tableName');
    expect(inputSchema?.required ?? []).toContain('config');
    expect(inputSchema?.required ?? []).not.toContain('tableName');
  });

  it('creates hosted stateful blocks', async () => {
    const {store, ensuredStatefulBlocks} = createTestStore();
    const createResult = await store
      .getState()
      .commands.invokeCommand('block-document.create');
    const artifactId = (createResult.data as any).artifactId as string;

    const statefulBlockResult = await store
      .getState()
      .commands.invokeCommand('block-document.create-stateful-block', {
        artifactId,
        blockId: 'dashboard-block',
        blockType: 'dashboard',
        intent: 'Explore regional sales interactively.',
        title: 'Regional Dashboard',
        caption: 'Regions',
      });

    expect(statefulBlockResult.success).toBe(true);
    expect(statefulBlockResult.data).toMatchObject({
      artifactId,
      blockId: 'dashboard-block',
      blockType: 'statefulBlock',
      statefulBlockType: 'dashboard',
      blockInstanceId: 'dashboard-block',
      ownership: 'owned',
      instanceTitle: 'Regional Dashboard',
      caption: 'Regions',
    });
    expect(store.getState().blockDocuments.getBlocks(artifactId)).toEqual([
      {
        id: 'dashboard-block',
        type: 'statefulBlock',
        intent: 'Explore regional sales interactively.',
        blockType: 'dashboard',
        blockInstanceId: 'dashboard-block',
        ownership: 'owned',
        caption: 'Regions',
      },
    ]);
    expect(ensuredStatefulBlocks).toEqual([
      {id: 'dashboard-block', title: 'Regional Dashboard'},
    ]);
    expect(
      store.getState().artifacts.getArtifact('dashboard-block'),
    ).toBeUndefined();
  });

  it('rejects unsupported hosted stateful block types when configured', async () => {
    const {store} = createTestStore();
    const createResult = await store
      .getState()
      .commands.invokeCommand('block-document.create');
    const artifactId = (createResult.data as any).artifactId as string;

    await expect(
      store
        .getState()
        .commands.invokeCommand('block-document.create-stateful-block', {
          artifactId,
          blockType: 'notebook',
        }),
    ).resolves.toMatchObject({
      success: false,
      error: 'Unsupported stateful block type "notebook".',
    });
  });

  it('restricts generic mutations to configured block capabilities', async () => {
    const {store} = createTestStore({
      allowedBlockTypes: ['paragraph', 'chart', 'statefulBlock'],
    });
    await expect(
      store.getState().commands.invokeCommand('block-document.create', {
        blocks: [{id: 'image-1', type: 'image', assetId: 'asset-1'}],
      }),
    ).resolves.toMatchObject({success: false});
    const createResult = await store
      .getState()
      .commands.invokeCommand('block-document.create');
    const artifactId = (createResult.data as any).artifactId as string;

    await expect(
      store.getState().commands.invokeCommand('block-document.append-blocks', {
        artifactId,
        blocks: [{id: 'image-1', type: 'image', assetId: 'asset-1'}],
      }),
    ).resolves.toMatchObject({success: false});
    await expect(
      store.getState().commands.invokeCommand('block-document.append-blocks', {
        artifactId,
        blocks: [
          {
            id: 'document-1',
            type: 'statefulBlock',
            blockType: 'markdown-document',
            blockInstanceId: 'document-1',
          },
        ],
      }),
    ).resolves.toMatchObject({success: false});
    await expect(
      store.getState().commands.invokeCommand('block-document.append-blocks', {
        artifactId,
        blocks: [
          {
            id: 'dashboard-1',
            type: 'statefulBlock',
            blockType: 'dashboard',
            blockInstanceId: 'dashboard-1',
          },
        ],
      }),
    ).resolves.toMatchObject({success: true});
    await expect(
      store.getState().commands.invokeCommand('block-document.update-block', {
        artifactId,
        blockId: 'dashboard-1',
        block: {id: 'ignored', type: 'image', assetId: 'asset-1'},
      }),
    ).resolves.toMatchObject({success: false});
    store.getState().blockDocuments.appendBlocks(artifactId, [
      {
        id: 'persisted-document-1',
        type: 'statefulBlock',
        blockType: 'markdown-document',
        blockInstanceId: 'persisted-document-1',
      },
    ]);
    await expect(
      store.getState().commands.invokeCommand('block-document.update-block', {
        artifactId,
        blockId: 'persisted-document-1',
        block: {
          id: 'ignored',
          type: 'paragraph',
          text: [{type: 'text', text: 'Replacement'}],
        },
      }),
    ).resolves.toMatchObject({success: false});
    await expect(
      store.getState().commands.invokeCommand('block-document.remove-block', {
        artifactId,
        blockId: 'persisted-document-1',
      }),
    ).resolves.toMatchObject({success: false});
    await expect(
      store.getState().commands.invokeCommand('block-document.move-block', {
        artifactId,
        blockId: 'persisted-document-1',
        toIndex: 0,
      }),
    ).resolves.toMatchObject({success: false});

    expect(store.getState().blockDocuments.getBlocks(artifactId)).toEqual([
      {
        id: 'dashboard-1',
        type: 'statefulBlock',
        blockType: 'dashboard',
        blockInstanceId: 'dashboard-1',
      },
      {
        id: 'persisted-document-1',
        type: 'statefulBlock',
        blockType: 'markdown-document',
        blockInstanceId: 'persisted-document-1',
      },
    ]);
  });

  it('fails clearly for invalid targets', async () => {
    const {store} = createTestStore();
    const markdownId = store.getState().artifacts.createArtifact({
      type: 'markdown-document',
      title: 'Markdown',
    });

    await expect(
      store.getState().commands.invokeCommand('block-document.get', {
        artifactId: 'missing',
      }),
    ).resolves.toMatchObject({
      success: false,
      error: 'Unknown artifact "missing".',
    });
    await expect(
      store.getState().commands.invokeCommand('block-document.get', {
        artifactId: markdownId,
      }),
    ).resolves.toMatchObject({
      success: false,
      error: `Artifact "${markdownId}" is not a block document artifact.`,
    });
  });
});
