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
  createMarkdownDocumentCommands,
  createMarkdownDocumentsSlice,
  type MarkdownDocumentsSliceState,
} from '../src';

type TestRoomState = BaseRoomStoreState &
  ArtifactsSliceState &
  MarkdownDocumentsSliceState &
  CommandSliceState<any>;

function createTestStore() {
  let timestamp = 100;
  const now = () => timestamp++;
  const artifactTypes = defineArtifactTypes({
    'markdown-document': {label: 'Markdown', defaultTitle: 'Markdown'},
    dashboard: {label: 'Dashboard', defaultTitle: 'Dashboard'},
  });

  const store = createStore<TestRoomState>()((...args) => ({
    ...createBaseRoomSlice()(...args),
    ...createCommandSlice<TestRoomState>()(...args),
    ...createArtifactsSlice({artifactTypes})(...args),
    ...createMarkdownDocumentsSlice<TestRoomState>({now})(...args),
  }));

  store
    .getState()
    .commands.registerCommands(
      '@sqlrooms/documents',
      createMarkdownDocumentCommands<TestRoomState>(),
    );
  return store;
}

describe('Markdown commands', () => {
  it('creates, lists, and reads Markdown document artifacts', async () => {
    const store = createTestStore();

    const createResult = await store
      .getState()
      .commands.invokeCommand('markdown-document.create', {
        title: 'Notes',
        markdown: '# Hello',
      });

    expect(createResult.success).toBe(true);
    const artifactId = (createResult.data as any).artifactId as string;
    expect(store.getState().artifacts.getArtifact(artifactId)).toMatchObject({
      id: artifactId,
      type: 'markdown-document',
      title: 'Notes',
    });
    expect(
      store.getState().markdownDocuments.getDocument(artifactId),
    ).toMatchObject({
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
      .commands.invokeCommand('markdown-document.list');
    expect(listResult.success).toBe(true);
    expect((listResult.data as any).markdownArtifacts).toEqual([
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
      .commands.invokeCommand('markdown-document.get', {artifactId});
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
      .commands.invokeCommand('markdown-document.get', {});
    expect(currentGetResult.success).toBe(true);
    expect(currentGetResult.data).toMatchObject({
      artifactId,
      title: 'Notes',
      markdown: '# Hello',
      assets: [],
      updatedAt: 101,
    });
  });

  it('keeps an AI command on its captured artifact target', async () => {
    const store = createTestStore();
    const artifactA = store.getState().artifacts.createArtifact({
      type: 'markdown-document',
      title: 'Markdown A',
    });
    store.getState().markdownDocuments.ensureDocument(artifactA);
    store.getState().markdownDocuments.setMarkdown(artifactA, 'Content A');
    const artifactB = store.getState().artifacts.createArtifact({
      type: 'markdown-document',
      title: 'Markdown B',
    });
    store.getState().markdownDocuments.ensureDocument(artifactB);
    store.getState().markdownDocuments.setMarkdown(artifactB, 'Content B');
    expect(store.getState().artifacts.config.currentArtifactId).toBe(artifactB);

    const aiInvocation = {
      surface: 'ai' as const,
      target: {kind: 'artifact', id: artifactA},
    };
    const capturedResult = await store
      .getState()
      .commands.invokeCommand('markdown-document.get', {}, aiInvocation);
    expect(capturedResult.data).toMatchObject({
      artifactId: artifactA,
      markdown: 'Content A',
    });

    const explicitResult = await store
      .getState()
      .commands.invokeCommand(
        'markdown-document.get',
        {artifactId: artifactB},
        aiInvocation,
      );
    expect(explicitResult.data).toMatchObject({
      artifactId: artifactB,
      markdown: 'Content B',
    });

    const paletteResult = await store
      .getState()
      .commands.invokeCommand(
        'markdown-document.get',
        {},
        {surface: 'palette'},
      );
    expect(paletteResult.data).toMatchObject({
      artifactId: artifactB,
      markdown: 'Content B',
    });
  });

  it('lists asset counts and returns asset metadata without data', async () => {
    const store = createTestStore();
    const createResult = await store
      .getState()
      .commands.invokeCommand('markdown-document.create', {
        title: 'Charts',
        markdown: '![Chart](asset://chart-1)',
      });
    const artifactId = (createResult.data as any).artifactId as string;

    store.getState().markdownDocuments.upsertAsset(artifactId, {
      id: 'chart-1',
      mediaType: 'image/svg+xml',
      encoding: 'utf8',
      data: '<svg />',
      alt: 'Chart',
      title: 'Chart title',
    });

    const listResult = await store
      .getState()
      .commands.invokeCommand('markdown-document.list');
    expect((listResult.data as any).markdownArtifacts[0]).toMatchObject({
      artifactId,
      assetCount: 1,
    });

    const getResult = await store
      .getState()
      .commands.invokeCommand('markdown-document.get', {artifactId});
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
      .commands.invokeCommand('markdown-document.create', {
        markdown: '# First',
      });
    const artifactId = (createResult.data as any).artifactId as string;

    const setResult = await store
      .getState()
      .commands.invokeCommand('markdown-document.set-markdown', {
        artifactId,
        markdown: '# Replacement',
      });
    expect(setResult.success).toBe(true);
    expect(
      store.getState().markdownDocuments.getDocument(artifactId),
    ).toMatchObject({
      markdown: '# Replacement',
      updatedAt: 102,
    });

    const appendResult = await store
      .getState()
      .commands.invokeCommand('markdown-document.append-markdown', {
        artifactId,
        markdown: 'More text',
      });
    expect(appendResult.success).toBe(true);
    expect(
      store.getState().markdownDocuments.getDocument(artifactId),
    ).toMatchObject({
      markdown: '# Replacement\n\nMore text',
      updatedAt: 103,
    });
  });

  it('fails clearly for invalid artifact IDs and non-Markdown document artifacts', async () => {
    const store = createTestStore();

    const missingResult = await store
      .getState()
      .commands.invokeCommand('markdown-document.get', {artifactId: 'missing'});
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
      .commands.invokeCommand('markdown-document.set-markdown', {
        artifactId: dashboardId,
        markdown: '# Nope',
      });
    expect(wrongTypeResult).toMatchObject({
      success: false,
      error: `Artifact "${dashboardId}" is not a Markdown document artifact.`,
    });
  });

  it('reads missing Markdown content without creating it', async () => {
    const store = createTestStore();
    const artifactId = store.getState().artifacts.createArtifact({
      type: 'markdown-document',
      title: 'Empty',
    });
    store.getState().markdownDocuments.removeDocument(artifactId);

    const result = await store
      .getState()
      .commands.invokeCommand('markdown-document.get', {artifactId});

    expect(result).toMatchObject({
      success: true,
      data: {artifactId, title: 'Empty', markdown: ''},
    });
    expect(
      store.getState().markdownDocuments.getDocument(artifactId),
    ).toBeUndefined();
  });

  it('can create without selecting the new Markdown document artifact', async () => {
    const store = createTestStore();
    const dashboardId = store.getState().artifacts.createArtifact({
      type: 'dashboard',
      title: 'Dashboard',
    });
    store.getState().artifacts.setCurrentArtifact(dashboardId);

    const result = await store
      .getState()
      .commands.invokeCommand('markdown-document.create', {
        title: 'Background',
        select: false,
      });

    expect(result.success).toBe(true);
    expect(store.getState().artifacts.config.currentArtifactId).toBe(
      dashboardId,
    );
  });
});
