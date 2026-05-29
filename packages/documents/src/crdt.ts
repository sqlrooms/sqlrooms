import {
  ArtifactMetadata,
  ArtifactsSliceConfig,
  type ArtifactMetadataType,
  type ArtifactsSliceState,
} from '@sqlrooms/artifacts';
import type {CrdtMirror} from '@sqlrooms/crdt';
import {schema} from 'loro-mirror';
import {
  BlocksDocumentsSliceConfig,
  type BlocksDocumentsSliceConfig as BlocksDocumentsSliceConfigType,
} from './BlocksDocumentSliceConfig';
import type {BlocksDocumentsSliceState} from './BlocksDocumentsSlice';
import {
  DocumentsSliceConfig,
  type DocumentAsset,
  type DocumentsSliceConfig as DocumentsSliceConfigType,
} from './DocumentsSliceConfig';
import type {DocumentsSliceState} from './DocumentsSlice';

type DocumentCrdtState = DocumentsSliceState &
  BlocksDocumentsSliceState &
  ArtifactsSliceState;
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
type IncomingBlocksDocument = Omit<
  BlocksDocumentsSliceConfigType['artifacts'][string],
  'assets'
> & {
  assets?: IncomingDocumentAsset[] | Record<string, DocumentAsset>;
};
type IncomingArtifact = {
  id: string;
  type?: string;
  title: string;
  visibility?: 'workspace' | 'embedded';
  parentArtifactId?: string | null;
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
  blocksDocuments: schema.LoroList(
    schema.LoroMap({
      id: schema.String(),
      content: schema.Any(),
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
    (blocksDocument) => blocksDocument.id,
  ),
  artifacts: schema.LoroList(
    schema.LoroMap({
      id: schema.String(),
      type: schema.String(),
      title: schema.String(),
      visibility: schema.Any(),
      parentArtifactId: schema.Any(),
    }),
    (artifact) => artifact.id,
  ),
  artifactOrder: schema.LoroList(schema.String()),
});

export type DocumentsMirrorSchema = typeof documentsMirrorSchema;

export const documentsMirrorInitialState = {
  documents: [],
  blocksDocuments: [],
  artifacts: [],
  artifactOrder: [],
};

export type CreateDocumentsCrdtMirrorOptions = {
  /**
   * Artifact types backed by the blocks document slice.
   *
   * Apps can use their own user-facing artifact names while reusing the generic
   * blocks document storage and CRDT mirror.
   */
  blocksDocumentArtifactTypes?: string[];
};

/**
 * Creates a CRDT mirror for Markdown documents, blocks documents, and their
 * artifact metadata.
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
>(
  options: CreateDocumentsCrdtMirrorOptions = {},
): CrdtMirror<S, typeof documentsMirrorSchema> {
  const blocksDocumentArtifactTypes = new Set(
    options.blocksDocumentArtifactTypes ?? ['blocks-document'],
  );
  const isSyncedArtifact = (artifact: ArtifactMetadataType) =>
    artifact.type === 'document' ||
    blocksDocumentArtifactTypes.has(artifact.type) ||
    artifact.visibility === 'embedded';
  const isNonSyncedArtifact = (artifact: ArtifactMetadataType) =>
    !isSyncedArtifact(artifact);

  return {
    schema: documentsMirrorSchema,
    initialState: documentsMirrorInitialState,
    select: (state) => {
      const artifactValues = Object.values(
        state.artifacts.config.artifactsById,
      ) as ArtifactMetadataType[];
      const syncedArtifacts = artifactValues.filter(
        (artifact) => isSyncedArtifact(artifact),
      );
      const syncedArtifactIds = new Set(
        syncedArtifacts.map((artifact) => artifact.id),
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
        blocksDocuments: Object.values(
          state.blocksDocuments.config.artifacts,
        ).map((blocksDocument) => ({
          id: blocksDocument.id,
          content: blocksDocument.content,
          assets: Object.values(blocksDocument.assets).map((asset) => ({
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
          updatedAt: blocksDocument.updatedAt,
        })),
        artifacts: syncedArtifacts.map((artifact) => ({
          id: artifact.id,
          type: artifact.type,
          title: artifact.title,
          visibility: artifact.visibility,
          parentArtifactId: artifact.parentArtifactId ?? null,
        })),
        artifactOrder: artifactOrder.filter((id) => syncedArtifactIds.has(id)),
      };
    },
    apply: (value, set, get) => {
      const incomingArtifacts = (value?.artifacts ?? []) as IncomingArtifact[];
      const incomingDocuments = (value?.documents ??
        []) as unknown as IncomingDocument[];
      const incomingBlocksDocuments = (value?.blocksDocuments ??
        []) as unknown as IncomingBlocksDocument[];
      const incomingArtifactOrder = (value?.artifactOrder ?? []) as string[];
      const syncedArtifacts: Record<string, ArtifactMetadataType> =
        Object.fromEntries(
          incomingArtifacts.map((artifact) => [
            artifact.id,
            ArtifactMetadata.parse({
              id: artifact.id,
              type: artifact.type ?? 'document',
              title: artifact.title,
              visibility: artifact.visibility,
              parentArtifactId: artifact.parentArtifactId ?? undefined,
            }),
          ]),
        );
      const documents = documentsArrayToRecord(incomingDocuments);
      const blocksDocuments = blocksDocumentsArrayToRecord(
        incomingBlocksDocuments,
      );
      const currentArtifactsConfig = get().artifacts.config;
      const currentArtifactsById =
        currentArtifactsConfig.artifactsById as Record<
          string,
          ArtifactMetadataType
        >;
      const nonSyncedArtifacts: Record<string, ArtifactMetadataType> =
        Object.fromEntries(
          Object.entries(currentArtifactsById).filter(
            ([, artifact]) => isNonSyncedArtifact(artifact),
          ),
        );
      const artifactsById: Record<string, ArtifactMetadataType> = {
        ...nonSyncedArtifacts,
        ...syncedArtifacts,
      };
      const currentArtifactOrder =
        currentArtifactsConfig.artifactOrder as string[];
      const incomingSyncedIds = new Set<string>();
      const incomingSyncedOrder = incomingArtifactOrder.filter((id) => {
        if (!syncedArtifacts[id] || incomingSyncedIds.has(id)) {
          return false;
        }
        incomingSyncedIds.add(id);
        return true;
      });
      const knownSyncedOrder = new Set(incomingSyncedOrder);
      const missingSyncedOrder = Object.keys(syncedArtifacts).filter(
        (id) => !knownSyncedOrder.has(id),
      );
      const nonSyncedOrder = currentArtifactOrder.filter((id) => {
        const artifact = artifactsById[id];
        return artifact != null && isNonSyncedArtifact(artifact);
      });
      const artifactOrder = [
        ...nonSyncedOrder,
        ...incomingSyncedOrder,
        ...missingSyncedOrder,
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
        blocksDocuments: {
          ...state.blocksDocuments,
          config: BlocksDocumentsSliceConfig.parse({
            artifacts: blocksDocuments,
          }),
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

function assetsArrayToRecord(
  assets: IncomingDocument['assets'] | IncomingBlocksDocument['assets'],
) {
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

function blocksDocumentsArrayToRecord(
  blocksDocuments: IncomingBlocksDocument[],
) {
  return Object.fromEntries(
    blocksDocuments.map((blocksDocument) => [
      blocksDocument.id,
      {
        id: blocksDocument.id,
        content: blocksDocument.content,
        assets: assetsArrayToRecord(blocksDocument.assets),
        updatedAt: blocksDocument.updatedAt,
      },
    ]),
  );
}
