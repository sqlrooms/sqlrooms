import type {ArtifactsSliceState} from '@sqlrooms/artifacts';
import type {
  BlockDocumentsSliceState,
  DocumentsSliceState,
} from '@sqlrooms/documents';
import {createDocumentsCrdtMirror} from '@sqlrooms/documents/crdt';

/** Migrates legacy CLI artifact names when applying persisted CRDT snapshots. */
export function createCliDocumentsCrdtMirror<
  S extends ArtifactsSliceState &
    DocumentsSliceState &
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
        artifacts: (value?.artifacts ?? []).map((artifact) => {
          if (artifact.type === 'worksheet') {
            return {...artifact, type: 'block-document'};
          }
          if (artifact.type === 'document') {
            return {
              ...artifact,
              type: blockDocumentIds.has(artifact.id)
                ? 'block-document'
                : 'markdown',
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
