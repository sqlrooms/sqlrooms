import {
  createArtifactsSlice,
  defineArtifactTypes,
  type ArtifactsSliceState,
} from '@sqlrooms/artifacts';
import {
  createBaseRoomSlice,
  type BaseRoomStoreState,
} from '@sqlrooms/room-store';
import {createCrdtSlice, type CrdtSliceState} from '@sqlrooms/crdt';
import {LoroDoc} from 'loro-crdt';
import {createStore} from 'zustand';
import {
  createBlocksDocumentsSlice,
  createDocumentsSlice,
  type BlocksDocumentsSliceState,
  type DocumentsSliceState,
} from '../src';
import {createDocumentsCrdtMirror} from '../src/crdt';

type TestRoomState = BaseRoomStoreState &
  ArtifactsSliceState &
  DocumentsSliceState &
  BlocksDocumentsSliceState &
  CrdtSliceState;

function createTestStore(doc: LoroDoc) {
  const artifactTypes = defineArtifactTypes({
    document: {
      label: 'Document',
      defaultTitle: 'Document',
      onCreate: ({artifactId, store}) => {
        store.getState().documents.ensureDocument(artifactId);
      },
    },
    dashboard: {label: 'Dashboard', defaultTitle: 'Dashboard'},
    analysis: {label: 'Analysis', defaultTitle: 'Analysis'},
  });

  return createStore<TestRoomState>()((set, get, store) => ({
    ...createBaseRoomSlice()(set, get, store),
    ...createArtifactsSlice<TestRoomState>({artifactTypes})(set, get, store),
    ...createDocumentsSlice<TestRoomState>({now: () => 123})(set, get, store),
    ...createBlocksDocumentsSlice<TestRoomState>({now: () => 456})(
      set,
      get,
      store,
    ),
    ...createCrdtSlice<TestRoomState>({
      doc,
      mirrors: {
        documentState: createDocumentsCrdtMirror<TestRoomState>(),
      },
    })(set, get, store),
  }));
}

async function flushCrdt() {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await Promise.resolve();
}

async function waitForCondition(assertion: () => boolean) {
  for (let i = 0; i < 10; i += 1) {
    if (assertion()) return;
    await flushCrdt();
  }
  throw new Error('Timed out waiting for CRDT state');
}

describe('documents CRDT mirrors', () => {
  it('mirrors document artifacts and markdown through Loro snapshots', async () => {
    const docA = new LoroDoc();
    const storeA = createTestStore(docA);
    await storeA.getState().crdt.initialize();

    const artifactId = storeA.getState().artifacts.createArtifact({
      id: 'doc-1',
      type: 'document',
      title: 'Notes',
    });
    storeA.getState().documents.setMarkdown(artifactId, '# Hello');
    storeA.getState().documents.upsertAsset(artifactId, {
      id: 'chart-1',
      mediaType: 'image/svg+xml',
      encoding: 'utf8',
      data: '<svg />',
      alt: 'Chart',
    });
    await waitForCondition(() =>
      JSON.stringify(docA.toJSON()).includes('chart-1'),
    );

    const snapshot = docA.export({mode: 'snapshot'});
    const docB = new LoroDoc();
    docB.import(snapshot);
    docB.checkoutToLatest();
    const storeB = createTestStore(docB);
    const dashboardId = storeB.getState().artifacts.createArtifact({
      id: 'dashboard-1',
      type: 'dashboard',
      title: 'Dashboard',
    });
    storeB.getState().artifacts.setCurrentArtifact(dashboardId);
    await storeB.getState().crdt.initialize();
    await waitForCondition(() =>
      Boolean(storeB.getState().artifacts.getArtifact('doc-1')),
    );

    expect(storeB.getState().artifacts.getArtifact('doc-1')).toMatchObject({
      id: 'doc-1',
      type: 'document',
      title: 'Notes',
    });
    expect(storeB.getState().artifacts.getArtifact(dashboardId)).toMatchObject({
      id: dashboardId,
      type: 'dashboard',
    });
    expect(storeB.getState().artifacts.config.currentArtifactId).toBe(
      dashboardId,
    );
    expect(storeB.getState().documents.getDocument('doc-1')).toMatchObject({
      id: 'doc-1',
      markdown: '# Hello',
      assets: {
        'chart-1': {
          id: 'chart-1',
          mediaType: 'image/svg+xml',
          encoding: 'utf8',
          data: '<svg />',
          alt: 'Chart',
          createdAt: 123,
          updatedAt: 123,
        },
      },
      updatedAt: 123,
    });
  });

  it('deduplicates incoming document order and drops unknown artifact IDs', () => {
    const store = createTestStore(new LoroDoc());
    const dashboardId = store.getState().artifacts.createArtifact({
      id: 'dashboard-1',
      type: 'dashboard',
      title: 'Dashboard',
    });
    store.setState((state) => ({
      ...state,
      artifacts: {
        ...state.artifacts,
        config: {
          ...state.artifacts.config,
          artifactOrder: ['deleted-artifact', dashboardId],
        },
      },
    }));

    createDocumentsCrdtMirror<TestRoomState>().apply(
      {
        artifacts: [
          {id: 'doc-1', type: 'document', title: 'Notes'},
          {id: 'doc-2', type: 'document', title: 'Ideas'},
        ],
        documents: [
          {id: 'doc-1', markdown: '# Notes', updatedAt: 1},
          {id: 'doc-2', markdown: '# Ideas', updatedAt: 2},
        ],
        artifactOrder: ['doc-1', 'unknown-doc', 'doc-1'],
      },
      store.setState,
      store.getState,
    );

    expect(store.getState().artifacts.config.artifactOrder).toEqual([
      dashboardId,
      'doc-1',
      'doc-2',
    ]);
  });

  it('mirrors analysis documents and embedded child artifact metadata', async () => {
    const docA = new LoroDoc();
    const storeA = createTestStore(docA);
    await storeA.getState().crdt.initialize();

    const analysisId = storeA.getState().artifacts.createArtifact({
      id: 'analysis-1',
      type: 'analysis',
      title: 'Analysis',
    });
    const dashboardId = storeA.getState().artifacts.createArtifact({
      id: 'dashboard-embedded-1',
      type: 'dashboard',
      title: 'Embedded Dashboard',
      visibility: 'embedded',
      parentArtifactId: analysisId,
    });
    storeA.getState().blocksDocuments.appendBlocks(analysisId, [
      {id: 'heading', type: 'heading', level: 1, text: 'Findings'},
      {
        id: 'chart',
        type: 'chart',
        tableName: 'sales',
        config: {
          chartType: 'histogram',
          settings: {field: 'revenue'},
        },
        selectionGroupId: 'overview',
      },
      {
        id: 'embed',
        type: 'artifactEmbed',
        artifactId: dashboardId,
        artifactType: 'dashboard',
      },
    ]);
    await waitForCondition(() =>
      JSON.stringify(docA.toJSON()).includes('dashboard-embedded-1'),
    );

    const snapshot = docA.export({mode: 'snapshot'});
    const docB = new LoroDoc();
    docB.import(snapshot);
    docB.checkoutToLatest();
    const storeB = createTestStore(docB);
    await storeB.getState().crdt.initialize();
    await waitForCondition(() =>
      Boolean(storeB.getState().artifacts.getArtifact(analysisId)),
    );

    expect(storeB.getState().artifacts.getArtifact(analysisId)).toMatchObject({
      id: analysisId,
      type: 'analysis',
      title: 'Analysis',
      visibility: 'workspace',
    });
    expect(storeB.getState().artifacts.getArtifact(dashboardId)).toMatchObject({
      id: dashboardId,
      type: 'dashboard',
      title: 'Embedded Dashboard',
      visibility: 'embedded',
      parentArtifactId: analysisId,
    });
    expect(storeB.getState().blocksDocuments.getBlocks(analysisId)).toEqual([
      {id: 'heading', type: 'heading', level: 1, text: 'Findings'},
      {
        id: 'chart',
        type: 'chart',
        tableName: 'sales',
        config: {
          chartType: 'histogram',
          settings: {field: 'revenue'},
        },
        selectionGroupId: 'overview',
      },
      {
        id: 'embed',
        type: 'artifactEmbed',
        artifactId: dashboardId,
        artifactType: 'dashboard',
      },
    ]);
  });

  it('preserves falsy asset metadata from incoming CRDT snapshots', () => {
    const store = createTestStore(new LoroDoc());

    createDocumentsCrdtMirror<TestRoomState>().apply(
      {
        artifacts: [{id: 'doc-1', type: 'document', title: 'Notes'}],
        documents: [
          {
            id: 'doc-1',
            markdown: '# Notes',
            assets: [
              {
                id: 'image-1',
                mediaType: 'image/svg+xml',
                encoding: 'utf8',
                data: '<svg />',
                filename: '',
                alt: '',
                title: '',
                provenance: false,
                createdAt: 1,
                updatedAt: 2,
              },
            ],
            updatedAt: 3,
          },
        ],
        artifactOrder: ['doc-1'],
      },
      store.setState,
      store.getState,
    );

    expect(store.getState().documents.getAsset('doc-1', 'image-1')).toEqual({
      id: 'image-1',
      mediaType: 'image/svg+xml',
      encoding: 'utf8',
      data: '<svg />',
      filename: '',
      alt: '',
      title: '',
      provenance: false,
      createdAt: 1,
      updatedAt: 2,
    });
  });
});
