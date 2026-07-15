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

function createTestStore() {
  let timestamp = 100;
  const ensuredStatefulBlocks: Array<{id: string; title: string}> = [];
  const now = () => timestamp++;
  const artifactTypes = defineArtifactTypes({
    'block-document': {
      label: 'Block Document',
      defaultTitle: 'Block Document',
    },
    dashboard: {label: 'Dashboard', defaultTitle: 'Dashboard'},
    document: {label: 'Document', defaultTitle: 'Document'},
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

  it('fails clearly for invalid targets', async () => {
    const {store} = createTestStore();
    const documentId = store.getState().artifacts.createArtifact({
      type: 'document',
      title: 'Document',
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
        artifactId: documentId,
      }),
    ).resolves.toMatchObject({
      success: false,
      error: `Artifact "${documentId}" is not a Block Document artifact.`,
    });
  });
});
