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
  createDocumentCommands,
  createDocumentsSlice,
  type DocumentsSliceState,
} from '../src';

type TestRoomState = BaseRoomStoreState &
  ArtifactsSliceState &
  DocumentsSliceState &
  CommandSliceState<any>;

function createTestStore() {
  let timestamp = 100;
  const now = () => timestamp++;
  const artifactTypes = defineArtifactTypes({
    document: {label: 'Document', defaultTitle: 'Document'},
    dashboard: {label: 'Dashboard', defaultTitle: 'Dashboard'},
  });

  const store = createStore<TestRoomState>()((...args) => ({
    ...createBaseRoomSlice()(...args),
    ...createCommandSlice<TestRoomState>()(...args),
    ...createArtifactsSlice<TestRoomState>({artifactTypes})(...args),
    ...createDocumentsSlice<TestRoomState>({now})(...args),
  }));

  store
    .getState()
    .commands.registerCommands(
      '@sqlrooms/documents',
      createDocumentCommands<TestRoomState>(),
    );
  return store;
}

describe('document commands', () => {
  it('creates, lists, and reads document artifacts', async () => {
    const store = createTestStore();

    const createResult = await store
      .getState()
      .commands.invokeCommand('document.create', {
        title: 'Notes',
        markdown: '# Hello',
      });

    expect(createResult.success).toBe(true);
    const artifactId = (createResult.data as any).artifactId as string;
    expect(store.getState().artifacts.getArtifact(artifactId)).toMatchObject({
      id: artifactId,
      type: 'document',
      title: 'Notes',
    });
    expect(store.getState().documents.getDocument(artifactId)).toMatchObject({
      markdown: '# Hello',
      updatedAt: 101,
    });
    expect(store.getState().artifacts.config.currentArtifactId).toBe(
      artifactId,
    );
    store.getState().artifacts.createArtifact({
      type: 'dashboard',
      title: 'Dashboard',
    });

    const listResult = await store
      .getState()
      .commands.invokeCommand('document.list');
    expect(listResult.success).toBe(true);
    expect((listResult.data as any).documents).toEqual([
      {
        artifactId,
        title: 'Notes',
        updatedAt: 101,
        markdownLength: 7,
        assetCount: 0,
      },
    ]);

    const explicitGetResult = await store
      .getState()
      .commands.invokeCommand('document.get', {artifactId});
    expect(explicitGetResult.success).toBe(true);
    expect(explicitGetResult.data).toMatchObject({
      artifactId,
      title: 'Notes',
      markdown: '# Hello',
      assets: [],
      updatedAt: 101,
    });

    store.getState().artifacts.setCurrentArtifact(artifactId);
    const currentGetResult = await store
      .getState()
      .commands.invokeCommand('document.get', {});
    expect(currentGetResult.success).toBe(true);
    expect(currentGetResult.data).toMatchObject({
      artifactId,
      title: 'Notes',
      markdown: '# Hello',
      assets: [],
      updatedAt: 101,
    });
  });

  it('lists asset counts and returns asset metadata without data', async () => {
    const store = createTestStore();
    const createResult = await store
      .getState()
      .commands.invokeCommand('document.create', {
        title: 'Charts',
        markdown: '![Chart](asset://chart-1)',
      });
    const artifactId = (createResult.data as any).artifactId as string;

    store.getState().documents.upsertAsset(artifactId, {
      id: 'chart-1',
      mediaType: 'image/svg+xml',
      encoding: 'utf8',
      data: '<svg />',
      alt: 'Chart',
      title: 'Chart title',
    });

    const listResult = await store
      .getState()
      .commands.invokeCommand('document.list');
    expect((listResult.data as any).documents[0]).toMatchObject({
      artifactId,
      assetCount: 1,
    });

    const getResult = await store
      .getState()
      .commands.invokeCommand('document.get', {artifactId});
    expect(getResult.data).toMatchObject({
      assets: [
        {
          id: 'chart-1',
          mediaType: 'image/svg+xml',
          encoding: 'utf8',
          alt: 'Chart',
          title: 'Chart title',
        },
      ],
    });
    expect((getResult.data as any).assets[0].data).toBeUndefined();
  });

  it('replaces and appends markdown', async () => {
    const store = createTestStore();
    const createResult = await store
      .getState()
      .commands.invokeCommand('document.create', {
        markdown: '# First',
      });
    const artifactId = (createResult.data as any).artifactId as string;

    const setResult = await store
      .getState()
      .commands.invokeCommand('document.set-markdown', {
        artifactId,
        markdown: '# Replacement',
      });
    expect(setResult.success).toBe(true);
    expect(store.getState().documents.getDocument(artifactId)).toMatchObject({
      markdown: '# Replacement',
      updatedAt: 102,
    });

    const appendResult = await store
      .getState()
      .commands.invokeCommand('document.append-markdown', {
        artifactId,
        markdown: 'More text',
      });
    expect(appendResult.success).toBe(true);
    expect(store.getState().documents.getDocument(artifactId)).toMatchObject({
      markdown: '# Replacement\n\nMore text',
      updatedAt: 103,
    });
  });

  it('fails clearly for invalid artifact IDs and non-document artifacts', async () => {
    const store = createTestStore();

    const missingResult = await store
      .getState()
      .commands.invokeCommand('document.get', {artifactId: 'missing'});
    expect(missingResult).toMatchObject({
      success: false,
      error: 'Unknown artifact "missing".',
    });

    const dashboardId = store.getState().artifacts.createArtifact({
      type: 'dashboard',
      title: 'Dashboard',
    });
    const wrongTypeResult = await store
      .getState()
      .commands.invokeCommand('document.set-markdown', {
        artifactId: dashboardId,
        markdown: '# Nope',
      });
    expect(wrongTypeResult).toMatchObject({
      success: false,
      error: `Artifact "${dashboardId}" is not a document artifact.`,
    });
  });

  it('reads missing document content without creating it', async () => {
    const store = createTestStore();
    const artifactId = store.getState().artifacts.createArtifact({
      type: 'document',
      title: 'Empty',
    });
    store.getState().documents.removeDocument(artifactId);

    const result = await store
      .getState()
      .commands.invokeCommand('document.get', {artifactId});

    expect(result).toMatchObject({
      success: true,
      data: {artifactId, title: 'Empty', markdown: ''},
    });
    expect(store.getState().documents.getDocument(artifactId)).toBeUndefined();
  });

  it('can create without selecting the new document', async () => {
    const store = createTestStore();
    const dashboardId = store.getState().artifacts.createArtifact({
      type: 'dashboard',
      title: 'Dashboard',
    });
    store.getState().artifacts.setCurrentArtifact(dashboardId);

    const result = await store
      .getState()
      .commands.invokeCommand('document.create', {
        title: 'Background',
        select: false,
      });

    expect(result.success).toBe(true);
    expect(store.getState().artifacts.config.currentArtifactId).toBe(
      dashboardId,
    );
  });
});
