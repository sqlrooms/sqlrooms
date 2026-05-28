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
  createAnalysisCommands,
  createAnalysisDocumentsSlice,
  type AnalysisDocumentsSliceState,
} from '../src';

type TestRoomState = BaseRoomStoreState &
  ArtifactsSliceState &
  AnalysisDocumentsSliceState &
  CommandSliceState<any>;

function createTestStore() {
  let timestamp = 100;
  const now = () => timestamp++;
  const artifactTypes = defineArtifactTypes({
    analysis: {label: 'Analysis', defaultTitle: 'Analysis'},
    dashboard: {label: 'Dashboard', defaultTitle: 'Dashboard'},
    document: {label: 'Document', defaultTitle: 'Document'},
  });

  const store = createStore<TestRoomState>()((...args) => ({
    ...createBaseRoomSlice()(...args),
    ...createCommandSlice<TestRoomState>()(...args),
    ...createArtifactsSlice<TestRoomState>({artifactTypes})(...args),
    ...createAnalysisDocumentsSlice<TestRoomState>({now})(...args),
  }));

  store
    .getState()
    .commands.registerCommands(
      '@sqlrooms/documents/analysis',
      createAnalysisCommands<TestRoomState>(),
    );
  return store;
}

describe('analysis commands', () => {
  it('creates, lists, and reads analysis artifacts', async () => {
    const store = createTestStore();

    const createResult = await store
      .getState()
      .commands.invokeCommand('analysis.create', {
        title: 'Findings',
        blocks: [{id: 'heading', type: 'heading', level: 1, text: 'Findings'}],
      });

    expect(createResult.success).toBe(true);
    const artifactId = (createResult.data as any).artifactId as string;
    expect(store.getState().artifacts.getArtifact(artifactId)).toMatchObject({
      id: artifactId,
      type: 'analysis',
      title: 'Findings',
    });
    expect(store.getState().analysisDocuments.getBlocks(artifactId)).toEqual([
      {id: 'heading', type: 'heading', level: 1, text: 'Findings'},
    ]);

    const listResult = await store
      .getState()
      .commands.invokeCommand('analysis.list');
    expect((listResult.data as any).analyses).toEqual([
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
      .commands.invokeCommand('analysis.get', {artifactId});
    expect(getResult.data).toMatchObject({
      artifactId,
      title: 'Findings',
      blocks: [{id: 'heading', type: 'heading', level: 1, text: 'Findings'}],
      assets: [],
      updatedAt: 101,
    });
  });

  it('mutates analysis blocks by command', async () => {
    const store = createTestStore();
    const createResult = await store
      .getState()
      .commands.invokeCommand('analysis.create');
    const artifactId = (createResult.data as any).artifactId as string;

    await store.getState().commands.invokeCommand('analysis.append-blocks', {
      artifactId,
      blocks: [{id: 'p1', type: 'paragraph', text: 'First'}],
    });
    await store.getState().commands.invokeCommand('analysis.insert-blocks', {
      artifactId,
      index: 0,
      blocks: [{id: 'h1', type: 'heading', level: 2, text: 'Overview'}],
    });
    await store.getState().commands.invokeCommand('analysis.update-block', {
      artifactId,
      blockId: 'p1',
      block: {id: 'ignored', type: 'paragraph', text: 'Updated'},
    });
    await store.getState().commands.invokeCommand('analysis.move-block', {
      artifactId,
      blockId: 'p1',
      toIndex: 0,
    });
    await store.getState().commands.invokeCommand('analysis.remove-block', {
      artifactId,
      blockId: 'h1',
    });

    expect(store.getState().analysisDocuments.getBlocks(artifactId)).toEqual([
      {id: 'p1', type: 'paragraph', text: 'Updated'},
    ]);
  });

  it('creates chart blocks and embedded dashboard blocks', async () => {
    const store = createTestStore();
    const createResult = await store
      .getState()
      .commands.invokeCommand('analysis.create');
    const artifactId = (createResult.data as any).artifactId as string;

    await store
      .getState()
      .commands.invokeCommand('analysis.create-chart-block', {
        artifactId,
        blockId: 'chart-1',
        tableName: 'sales',
        config: {chartType: 'histogram', settings: {field: 'revenue'}},
        selectionGroupId: 'overview',
        caption: 'Revenue',
      });
    const embedResult = await store
      .getState()
      .commands.invokeCommand('analysis.embed-dashboard', {
        artifactId,
        blockId: 'dashboard-1',
        dashboardTitle: 'Dashboard',
        caption: 'Details',
      });

    const dashboardArtifactId = (embedResult.data as any)
      .dashboardArtifactId as string;
    expect(
      store.getState().artifacts.getArtifact(dashboardArtifactId),
    ).toMatchObject({
      type: 'dashboard',
      title: 'Dashboard',
      visibility: 'embedded',
      parentArtifactId: artifactId,
    });
    expect(store.getState().analysisDocuments.getBlocks(artifactId)).toEqual([
      {
        id: 'chart-1',
        type: 'chart',
        tableName: 'sales',
        config: {chartType: 'histogram', settings: {field: 'revenue'}},
        selectionGroupId: 'overview',
        caption: 'Revenue',
      },
      {
        id: 'dashboard-1',
        type: 'artifactEmbed',
        artifactId: dashboardArtifactId,
        artifactType: 'dashboard',
        caption: 'Details',
      },
    ]);
  });

  it('fails clearly for invalid targets', async () => {
    const store = createTestStore();
    const documentId = store.getState().artifacts.createArtifact({
      type: 'document',
      title: 'Document',
    });

    await expect(
      store.getState().commands.invokeCommand('analysis.get', {
        artifactId: 'missing',
      }),
    ).resolves.toMatchObject({
      success: false,
      error: 'Unknown artifact "missing".',
    });
    await expect(
      store.getState().commands.invokeCommand('analysis.get', {
        artifactId: documentId,
      }),
    ).resolves.toMatchObject({
      success: false,
      error: `Artifact "${documentId}" is not an analysis artifact.`,
    });
  });
});
