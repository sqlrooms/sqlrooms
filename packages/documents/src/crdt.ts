import {
  ArtifactsSliceConfig,
  type ArtifactsSliceState,
} from '@sqlrooms/artifacts';
import type {CrdtMirror} from '@sqlrooms/crdt';
import {schema} from 'loro-mirror';
import {
  DocumentsSliceConfig,
  type DocumentsSliceConfig as DocumentsSliceConfigType,
} from './DocumentsSliceConfig';
import type {DocumentsSliceState} from './DocumentsSlice';

type DocumentCrdtState = DocumentsSliceState & ArtifactsSliceState;

export const documentsMirrorSchema = schema.LoroMap({
  documents: schema.LoroList(
    schema.LoroMap({
      id: schema.String(),
      markdown: schema.String(),
      updatedAt: schema.Number(),
    }),
    (document) => document.id,
  ),
  artifacts: schema.LoroList(
    schema.LoroMap({
      id: schema.String(),
      type: schema.String(),
      title: schema.String(),
    }),
    (artifact) => artifact.id,
  ),
  artifactOrder: schema.LoroList(schema.String()),
});

export type DocumentsMirrorSchema = typeof documentsMirrorSchema;

export const documentsMirrorInitialState = {
  documents: [],
  artifacts: [],
  artifactOrder: [],
};

/**
 * Creates a CRDT mirror for Markdown documents and their document artifact metadata.
 *
 * The room's current artifact selection is intentionally kept local.
 */
export function createDocumentsCrdtMirror<
  S extends DocumentCrdtState = DocumentCrdtState,
>(): CrdtMirror<S, typeof documentsMirrorSchema> {
  return {
    schema: documentsMirrorSchema,
    initialState: documentsMirrorInitialState,
    select: (state) => {
      const documentArtifacts = Object.values(
        state.artifacts.config.artifactsById,
      ).filter((artifact) => artifact.type === 'document');
      const documentIds = new Set(
        documentArtifacts.map((artifact) => artifact.id),
      );
      return {
        documents: Object.values(state.documents.config.artifacts).map(
          (document) => ({
            id: document.id,
            markdown: document.markdown,
            updatedAt: document.updatedAt,
          }),
        ),
        artifacts: documentArtifacts.map((artifact) => ({
          id: artifact.id,
          type: artifact.type,
          title: artifact.title,
        })),
        artifactOrder: state.artifacts.config.artifactOrder.filter((id) =>
          documentIds.has(id),
        ),
      };
    },
    apply: (value, set, get) => {
      const documentArtifacts = Object.fromEntries(
        (value?.artifacts ?? []).map((artifact) => [
          artifact.id,
          {
            id: artifact.id,
            type: 'document',
            title: artifact.title,
          },
        ]),
      );
      const documents = documentsArrayToRecord(value?.documents ?? []);
      const currentArtifactsConfig = get().artifacts.config;
      const nonDocumentArtifacts = Object.fromEntries(
        Object.entries(currentArtifactsConfig.artifactsById).filter(
          ([, artifact]) => artifact.type !== 'document',
        ),
      );
      const artifactsById = {
        ...nonDocumentArtifacts,
        ...documentArtifacts,
      };
      const incomingDocumentOrder = (value?.artifactOrder ?? []).filter(
        (id) => documentArtifacts[id],
      );
      const knownDocumentOrder = new Set(incomingDocumentOrder);
      const missingDocumentOrder = Object.keys(documentArtifacts).filter(
        (id) => !knownDocumentOrder.has(id),
      );
      const nonDocumentOrder = currentArtifactsConfig.artifactOrder.filter(
        (id) => artifactsById[id]?.type !== 'document',
      );
      const artifactOrder = [
        ...nonDocumentOrder,
        ...incomingDocumentOrder,
        ...missingDocumentOrder,
      ];
      const currentArtifactId = currentArtifactsConfig.currentArtifactId;

      set((state: S) => ({
        ...state,
        artifacts: {
          ...state.artifacts,
          config: ArtifactsSliceConfig.parse({
            artifactsById,
            artifactOrder,
            currentArtifactId:
              currentArtifactId && artifactsById[currentArtifactId]
                ? currentArtifactId
                : undefined,
          }),
        },
        documents: {
          ...state.documents,
          config: DocumentsSliceConfig.parse({artifacts: documents}),
        },
      }));
    },
  };
}

function documentsArrayToRecord(
  documents: DocumentsSliceConfigType['artifacts'][string][],
) {
  return Object.fromEntries(
    documents.map((document) => [
      document.id,
      {
        id: document.id,
        markdown: document.markdown,
        updatedAt: document.updatedAt,
      },
    ]),
  );
}
