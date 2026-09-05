import {
  createArtifactsSlice,
  defineArtifactTypes,
  type ArtifactsSliceState,
} from '@sqlrooms/artifacts';
import {
  createBlockDocumentsSlice,
  createDocumentsSlice,
  type BlockDocumentsSliceState,
  type DocumentsSliceState,
} from '@sqlrooms/documents';
import {
  createBaseRoomSlice,
  type BaseRoomStoreState,
} from '@sqlrooms/room-store';
import {createStore} from 'zustand';
import {createCliDocumentsCrdtMirror} from '../createCliDocumentsCrdtMirror';

type TestState = BaseRoomStoreState &
  ArtifactsSliceState &
  DocumentsSliceState &
  BlockDocumentsSliceState;

it('migrates legacy CRDT metadata while preserving content and canonical output', () => {
  const store = createStore<TestState>()((...args) => ({
    ...createBaseRoomSlice()(...args),
    ...createArtifactsSlice({
      artifactTypes: defineArtifactTypes({
        'block-document': {label: 'Document'},
        markdown: {label: 'Markdown'},
      }),
    })(...args),
    ...createDocumentsSlice<TestState>()(...args),
    ...createBlockDocumentsSlice<TestState>()(...args),
  }));
  for (const id of ['legacy-block', 'worksheet', 'canonical']) {
    store.getState().artifacts.createArtifact({id, type: 'block-document'});
    store.getState().blockDocuments.ensureBlockDocument(id);
  }
  store.getState().artifacts.createArtifact({id: 'markdown', type: 'markdown'});
  store.getState().documents.ensureDocument('markdown');
  const mirror = createCliDocumentsCrdtMirror<TestState>();
  const canonical = mirror.select!(store.getState());
  const legacy = {
    ...canonical,
    artifacts: canonical.artifacts.map((artifact) => ({
      ...artifact,
      type:
        artifact.id === 'worksheet'
          ? 'worksheet'
          : artifact.id === 'canonical'
            ? 'block-document'
            : 'document',
    })),
  } as Parameters<typeof mirror.apply>[0];

  mirror.apply(legacy, store.setState, store.getState);

  expect(mirror.select!(store.getState())).toEqual(canonical);
  expect(
    legacy.artifacts.find((artifact) => artifact.id === 'legacy-block')?.type,
  ).toBe('document');
});
