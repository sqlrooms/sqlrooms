import {
  ArtifactMetadata,
  ArtifactsSliceConfig,
  type ArtifactMetadataType,
  type ArtifactsSliceState,
} from '@sqlrooms/artifacts';
import type {CrdtMirror} from '@sqlrooms/crdt';
import {schema} from 'loro-mirror';
import {
  DocumentsSliceConfig,
  type DocumentAsset,
  type DocumentsSliceConfig as DocumentsSliceConfigType,
} from './DocumentsSliceConfig';
import type {DocumentsSliceState} from './DocumentsSlice';

type DocumentCrdtState = DocumentsSliceState & ArtifactsSliceState;
type OmitAssetMetadata<T extends DocumentAsset> = Omit<
  T,
  'filename' | 'alt' | 'title' | 'provenance'
>;
type IncomingDocumentAsset = (DocumentAsset extends infer Asset
  ? Asset extends DocumentAsset
    ? OmitAssetMetadata<Asset>
    : never
  : never) & {
  filename?: string | null;
  alt?: string | null;
  title?: string | null;
  provenance?: unknown;
};
type IncomingDocument = Omit<
  DocumentsSliceConfigType['artifacts'][string],
  'assets'
> & {
  assets?: IncomingDocumentAsset[] | Record<string, DocumentAsset>;
};

export const documentsMirrorSchema = schema.LoroMap({
  documents: schema.LoroList(
    schema.LoroMap({
      id: schema.String(),
      markdown: schema.String(),
      assets: schema.LoroList(
        schema.LoroMap({
          id: schema.String(),
          mediaType: schema.String(),
          encoding: schema.String(),
          data: schema.String(),
          filename: schema.Any(),
          alt: schema.Any(),
          title: schema.Any(),
          provenance: schema.Any(),
          createdAt: schema.Number(),
          updatedAt: schema.Number(),
        }),
        (asset) => asset.id,
      ),
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
            assets: Object.values(document.assets).map((asset) => ({
              id: asset.id,
              mediaType: asset.mediaType,
              encoding: asset.encoding,
              data: asset.data,
              filename: asset.filename ?? null,
              alt: asset.alt ?? null,
              title: asset.title ?? null,
              provenance: asset.provenance ?? null,
              createdAt: asset.createdAt,
              updatedAt: asset.updatedAt,
            })),
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
        []) as unknown as IncomingDocument[];
      const incomingArtifactOrder = (value?.artifactOrder ?? []) as string[];
      const documentArtifacts: Record<string, ArtifactMetadataType> =
        Object.fromEntries(
          incomingArtifacts.map((artifact) => [
            artifact.id,
            ArtifactMetadata.parse({
              id: artifact.id,
              type: 'document',
              title: artifact.title,
            }),
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
      const incomingDocumentIds = new Set<string>();
      const incomingDocumentOrder = incomingArtifactOrder.filter((id) => {
        if (!documentArtifacts[id] || incomingDocumentIds.has(id)) {
          return false;
        }
        incomingDocumentIds.add(id);
        return true;
      });
      const knownDocumentOrder = new Set(incomingDocumentOrder);
      const missingDocumentOrder = Object.keys(documentArtifacts).filter(
        (id) => !knownDocumentOrder.has(id),
      );
      const nonDocumentOrder = currentArtifactOrder.filter((id) => {
        const artifact = artifactsById[id];
        return artifact != null && artifact.type !== 'document';
      });
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

function documentsArrayToRecord(documents: IncomingDocument[]) {
  return Object.fromEntries(
    documents.map((document) => [
      document.id,
      {
        id: document.id,
        markdown: document.markdown,
        assets: assetsArrayToRecord(document.assets),
        updatedAt: document.updatedAt,
      },
    ]),
  );
}

function assetsArrayToRecord(assets: IncomingDocument['assets']) {
  if (!assets) return {};
  const assetArray = Array.isArray(assets) ? assets : Object.values(assets);
  return Object.fromEntries(
    assetArray.map((asset) => [
      asset.id,
      {
        id: asset.id,
        mediaType: asset.mediaType,
        encoding: asset.encoding,
        data: asset.data,
        ...(asset.filename != null ? {filename: asset.filename} : {}),
        ...(asset.alt != null ? {alt: asset.alt} : {}),
        ...(asset.title != null ? {title: asset.title} : {}),
        ...(asset.provenance != null ? {provenance: asset.provenance} : {}),
        createdAt: asset.createdAt,
        updatedAt: asset.updatedAt,
      },
    ]),
  );
}
