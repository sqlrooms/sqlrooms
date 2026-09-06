import type {ArtifactsSliceState} from '@sqlrooms/artifacts';
import type {
  BlockDocumentsSliceState,
  MarkdownDocumentsSliceState,
} from '@sqlrooms/documents';
import {createDocumentsCrdtMirror} from '@sqlrooms/documents/crdt';
import {migrateEmbeddedMarkdownBlockTypes} from './migrateCliPersistedWorkspace';

/** Migrates legacy CLI artifact names when applying persisted CRDT snapshots. */
export function createCliDocumentsCrdtMirror<
  S extends ArtifactsSliceState &
    MarkdownDocumentsSliceState &
    BlockDocumentsSliceState,
>() {
  const mirror = createDocumentsCrdtMirror<S>();
  const apply: NonNullable<typeof mirror.apply> = (value, set, get) => {
    const blockDocumentIds = new Set(
      (value?.blockDocuments ?? []).map((document) => document.id),
    );
    mirror.apply?.(
      {
        ...value,
        blockDocuments: (value?.blockDocuments ?? []).map((document) => ({
          ...document,
          content: migrateEmbeddedMarkdownBlockTypes(document.content),
        })),
        artifacts: (value?.artifacts ?? []).map((artifact) => {
          if (artifact.type === 'worksheet') {
            return {...artifact, type: 'block-document'};
          }
          if (artifact.type === 'markdown') {
            return {...artifact, type: 'markdown-document'};
          }
          if (artifact.type === 'document') {
            return {
              ...artifact,
              type: blockDocumentIds.has(artifact.id)
                ? 'block-document'
                : 'markdown-document',
            };
          }
          return artifact;
        }),
      },
      set,
      get,
    );
  };
  return {...mirror, apply};
}
