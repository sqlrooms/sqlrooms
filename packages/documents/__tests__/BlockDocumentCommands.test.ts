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
    ...createArtifactsSlice<TestRoomState>({artifactTypes})(...args),
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
          ensureState: ({state, blockInstanceId, title}) => {
            state.artifacts.createArtifact({
              id: blockInstanceId,
              type: 'dashboard',
              title,
              visibility: 'embedded',
            });
          },
        },
      ],
    }),
  );
  return store;
}

describe('block document commands', () => {
  it('creates, lists, and reads block document artifacts', async () => {
    const store = createTestStore();

    const createResult = await store
      .getState()
      .commands.invokeCommand('block-document.create', {
        title: 'Findings',
        blocks: [{id: 'heading', type: 'heading', level: 1, text: 'Findings'}],
      });

    expect(createResult.success).toBe(true);
    const artifactId = (createResult.data as any).artifactId as string;
    expect(store.getState().artifacts.getArtifact(artifactId)).toMatchObject({
      id: artifactId,
      type: 'block-document',
      title: 'Findings',
    });
    expect(store.getState().blockDocuments.getBlocks(artifactId)).toEqual([
      {id: 'heading', type: 'heading', level: 1, text: 'Findings'},
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
      blocks: [{id: 'heading', type: 'heading', level: 1, text: 'Findings'}],
      assets: [],
      updatedAt: 101,
    });
  });

  it('mutates block document blocks by command', async () => {
    const store = createTestStore();
    const createResult = await store
      .getState()
      .commands.invokeCommand('block-document.create');
    const artifactId = (createResult.data as any).artifactId as string;

    await store
      .getState()
      .commands.invokeCommand('block-document.append-blocks', {
        artifactId,
        blocks: [{id: 'p1', type: 'paragraph', text: 'First'}],
      });
    await store
      .getState()
      .commands.invokeCommand('block-document.insert-blocks', {
        artifactId,
        index: 0,
        blocks: [{id: 'h1', type: 'heading', level: 2, text: 'Overview'}],
      });
    await store
      .getState()
      .commands.invokeCommand('block-document.update-block', {
        artifactId,
        blockId: 'p1',
        block: {id: 'ignored', type: 'paragraph', text: 'Updated'},
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
      {id: 'p1', type: 'paragraph', text: 'Updated'},
    ]);
  });

  it('creates chart blocks', async () => {
    const store = createTestStore();
    const createResult = await store
      .getState()
      .commands.invokeCommand('block-document.create');
    const artifactId = (createResult.data as any).artifactId as string;

    await store
      .getState()
      .commands.invokeCommand('block-document.create-chart-block', {
        artifactId,
        blockId: 'chart-1',
        tableName: 'sales',
        config: {chartType: 'histogram', settings: {field: 'revenue'}},
        selectionGroupId: 'overview',
        caption: 'Revenue',
      });
    expect(store.getState().blockDocuments.getBlocks(artifactId)).toEqual([
      {
        id: 'chart-1',
        type: 'chart',
        tableName: 'sales',
        config: {chartType: 'histogram', settings: {field: 'revenue'}},
        selectionGroupId: 'overview',
        caption: 'Revenue',
      },
    ]);
  });

  it('creates hosted stateful blocks', async () => {
    const store = createTestStore();
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
        title: 'Regional Dashboard',
        caption: 'Regions',
      });

    expect(statefulBlockResult.success).toBe(true);
    expect(store.getState().blockDocuments.getBlocks(artifactId)).toEqual([
      {
        id: 'dashboard-block',
        type: 'statefulBlock',
        blockType: 'dashboard',
        blockInstanceId: 'dashboard-block',
        ownership: 'owned',
        title: 'Regional Dashboard',
        caption: 'Regions',
      },
    ]);
    expect(
      store.getState().artifacts.getArtifact('dashboard-block'),
    ).toMatchObject({
      id: 'dashboard-block',
      type: 'dashboard',
      title: 'Regional Dashboard',
      visibility: 'embedded',
    });
  });

  it('rejects unsupported hosted stateful block types when configured', async () => {
    const store = createTestStore();
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
    const store = createTestStore();
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
