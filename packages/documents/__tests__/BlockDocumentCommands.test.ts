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
}: {
  allowedBlockTypes?: Parameters<
    typeof createBlockDocumentCommands<TestRoomState>
  >[0]['allowedBlockTypes'];
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
    markdown: {label: 'Markdown', defaultTitle: 'Markdown'},
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
          label: 'Dashboard',
          defaultTitle: 'Embedded Dashboard',
          ensureState: ({blockInstanceId, title}) => {
            ensuredStatefulBlocks.push({id: blockInstanceId, title});
          },
        },
      ],
      allowedBlockTypes,
    }),
  );
  return {store, ensuredStatefulBlocks};
}

describe('block document commands', () => {
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
            blockType: 'markdown',
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
        blockType: 'markdown',
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
        blockType: 'markdown',
        blockInstanceId: 'persisted-document-1',
      },
    ]);
  });

  it('fails clearly for invalid targets', async () => {
    const {store} = createTestStore();
    const markdownId = store.getState().artifacts.createArtifact({
      type: 'markdown',
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
      error: `Artifact "${markdownId}" is not a Block Document artifact.`,
    });
  });
});
