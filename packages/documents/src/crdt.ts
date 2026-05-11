import {
  ArtifactsSliceConfig,
  type ArtifactMetadataType,
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
 *
 * TODO: Once the Tiptap document schema settles, replace the Markdown body
 * snapshot in this mirror with a structured ProseMirror/Loro body synced via
 * `loro-prosemirror`; keep this mirror focused on registry and artifact
 * metadata during that migration.
 */
export function createDocumentsCrdtMirror<
  S extends DocumentCrdtState = DocumentCrdtState,
>(): CrdtMirror<S, typeof documentsMirrorSchema> {
  return {
    schema: documentsMirrorSchema,
    initialState: documentsMirrorInitialState,
    select: (state) => {
      const artifactValues = Object.values(
        state.artifacts.config.artifactsById,
      ) as ArtifactMetadataType[];
      const documentArtifacts = artifactValues.filter(
        (artifact) => artifact.type === 'document',
      );
      const documentIds = new Set(
        documentArtifacts.map((artifact) => artifact.id),
      );
      const artifactOrder = state.artifacts.config.artifactOrder as string[];
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
        artifactOrder: artifactOrder.filter((id) => documentIds.has(id)),
      };
    },
    apply: (value, set, get) => {
      const incomingArtifacts = (value?.artifacts ?? []) as Array<{
        id: string;
        title: string;
      }>;
      const incomingDocuments = (value?.documents ??
        []) as DocumentsSliceConfigType['artifacts'][string][];
      const incomingArtifactOrder = (value?.artifactOrder ?? []) as string[];
      const documentArtifacts: Record<string, ArtifactMetadataType> =
        Object.fromEntries(
          incomingArtifacts.map((artifact) => [
            artifact.id,
            {
              id: artifact.id,
              type: 'document',
              title: artifact.title,
            },
          ]),
        );
      const documents = documentsArrayToRecord(incomingDocuments);
      const currentArtifactsConfig = get().artifacts.config;
      const currentArtifactsById =
        currentArtifactsConfig.artifactsById as Record<
          string,
          ArtifactMetadataType
        >;
      const nonDocumentArtifacts: Record<string, ArtifactMetadataType> =
        Object.fromEntries(
          Object.entries(currentArtifactsById).filter(
            ([, artifact]) => artifact.type !== 'document',
          ),
        );
      const artifactsById: Record<string, ArtifactMetadataType> = {
        ...nonDocumentArtifacts,
        ...documentArtifacts,
      };
      const currentArtifactOrder =
        currentArtifactsConfig.artifactOrder as string[];
      const incomingDocumentOrder = incomingArtifactOrder.filter(
        (id) => documentArtifacts[id],
      );
      const knownDocumentOrder = new Set(incomingDocumentOrder);
      const missingDocumentOrder = Object.keys(documentArtifacts).filter(
        (id) => !knownDocumentOrder.has(id),
      );
      const nonDocumentOrder = currentArtifactOrder.filter(
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
