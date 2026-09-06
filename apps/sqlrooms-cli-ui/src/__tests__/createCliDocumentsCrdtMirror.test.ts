import {
  createArtifactsSlice,
  defineArtifactTypes,
  type ArtifactsSliceState,
} from '@sqlrooms/artifacts';
import {
  createBlockDocumentsSlice,
  createMarkdownDocumentsSlice,
  type BlockDocumentsSliceState,
  type MarkdownDocumentsSliceState,
} from '@sqlrooms/documents';
import {
  createBaseRoomSlice,
  type BaseRoomStoreState,
} from '@sqlrooms/room-store';
import {createStore} from 'zustand';
import {createCliDocumentsCrdtMirror} from '../createCliDocumentsCrdtMirror';

type TestState = BaseRoomStoreState &
  ArtifactsSliceState &
  MarkdownDocumentsSliceState &
  BlockDocumentsSliceState;

it.each(['document', 'markdown'])(
  'migrates legacy %s CRDT metadata and embedded blocks while preserving content',
  (legacyType) => {
    const store = createStore<TestState>()((...args) => ({
      ...createBaseRoomSlice()(...args),
      ...createArtifactsSlice({
        artifactTypes: defineArtifactTypes({
          'block-document': {label: 'Document'},
          'markdown-document': {label: 'Markdown'},
        }),
      })(...args),
      ...createMarkdownDocumentsSlice<TestState>()(...args),
      ...createBlockDocumentsSlice<TestState>()(...args),
    }));
    for (const id of ['legacy-block', 'worksheet', 'canonical']) {
      store.getState().artifacts.createArtifact({id, type: 'block-document'});
      store.getState().blockDocuments.ensureBlockDocument(id);
    }
    store.getState().artifacts.createArtifact({
      id: 'markdown-document',
      type: 'markdown-document',
    });
    store.getState().markdownDocuments.ensureDocument('markdown-document');
    const mirror = createCliDocumentsCrdtMirror<TestState>();
    const canonical = mirror.select!(store.getState());
    canonical.blockDocuments[0]!.content = {
      type: 'prosemirror-json',
      body: {
        type: 'doc',
        content: [
          {
            type: 'blockDocumentStatefulBlock',
            attrs: {
              id: 'embedded',
              blockType: 'markdown-document',
              blockInstanceId: 'markdown-document',
            },
          },
        ],
      },
    };

    const legacy = {
      ...canonical,
      blockDocuments: canonical.blockDocuments.map((document) => ({
        ...document,
        content: JSON.parse(
          JSON.stringify(document.content).replace(
            /"blockType":"markdown-document"/g,
            `"blockType":"${legacyType}"`,
          ),
        ),
      })),
      artifacts: canonical.artifacts.map((artifact) => ({
        ...artifact,
        type:
          artifact.id === 'worksheet'
            ? 'worksheet'
            : artifact.id === 'canonical'
              ? 'block-document'
              : artifact.id === 'markdown-document'
                ? legacyType
                : 'document',
      })),
    } as Parameters<typeof mirror.apply>[0];

    mirror.apply(legacy, store.setState, store.getState);

    expect(mirror.select!(store.getState())).toEqual(canonical);
    expect(
      legacy.artifacts.find((artifact) => artifact.id === 'legacy-block')?.type,
    ).toBe('document');
  },
);
