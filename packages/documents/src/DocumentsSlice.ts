import {BaseRoomStoreState, createSlice} from '@sqlrooms/room-store';
import {produce} from 'immer';
import {
  DocumentAsset,
  DocumentArtifact,
  DocumentsSliceConfig,
  type DocumentAsset as DocumentAssetType,
  type DocumentsSliceConfig as DocumentsSliceConfigType,
} from './DocumentsSliceConfig';

export type DocumentAssetInput = Omit<
  DocumentAssetType,
  'createdAt' | 'updatedAt'
> &
  Partial<Pick<DocumentAssetType, 'createdAt' | 'updatedAt'>>;

export type DocumentsSliceState = {
  documents: {
    config: DocumentsSliceConfigType;
    setConfig: (config: DocumentsSliceConfigType) => void;
    ensureDocument: (artifactId: string, markdown?: string) => void;
    removeDocument: (artifactId: string) => void;
    setMarkdown: (artifactId: string, markdown: string) => void;
    upsertAsset: (artifactId: string, asset: DocumentAssetInput) => void;
    removeAsset: (artifactId: string, assetId: string) => void;
    getAsset: (
      artifactId: string,
      assetId: string,
    ) => DocumentAssetType | undefined;
    getDocument: (artifactId: string) => DocumentArtifact | undefined;
  };
};

export type CreateDocumentsSliceProps = {
  config?: Partial<DocumentsSliceConfigType>;
  now?: () => number;
};

export function createDefaultDocumentsConfig(
  props: Partial<DocumentsSliceConfigType> = {},
): DocumentsSliceConfigType {
  return DocumentsSliceConfig.parse({artifacts: {}, ...props});
}

export function createDocumentsSlice<
  TRoomState extends BaseRoomStoreState & DocumentsSliceState,
>(props: CreateDocumentsSliceProps = {}) {
  const now = props.now ?? Date.now;

  return createSlice<DocumentsSliceState, TRoomState>((set, get) => ({
    documents: {
      config: createDefaultDocumentsConfig(props.config),

      setConfig(config) {
        set((state) =>
          produce(state, (draft) => {
            draft.documents.config = DocumentsSliceConfig.parse(config);
          }),
        );
      },

      ensureDocument(artifactId, markdown = '') {
        set((state) =>
          produce(state, (draft) => {
            if (draft.documents.config.artifacts[artifactId]) return;
            draft.documents.config.artifacts[artifactId] =
              DocumentArtifact.parse({
                id: artifactId,
                markdown,
                updatedAt: now(),
              });
          }),
        );
      },

      removeDocument(artifactId) {
        set((state) =>
          produce(state, (draft) => {
            delete draft.documents.config.artifacts[artifactId];
          }),
        );
      },

      setMarkdown(artifactId, markdown) {
        set((state) =>
          produce(state, (draft) => {
            const existing = draft.documents.config.artifacts[artifactId];
            if (existing) {
              existing.markdown = markdown;
              existing.updatedAt = now();
              return;
            }
            draft.documents.config.artifacts[artifactId] =
              DocumentArtifact.parse({
                id: artifactId,
                markdown,
                updatedAt: now(),
              });
          }),
        );
      },

      upsertAsset(artifactId, asset) {
        set((state) =>
          produce(state, (draft) => {
            const timestamp = now();
            const existingDocument =
              draft.documents.config.artifacts[artifactId];
            if (!existingDocument) {
              draft.documents.config.artifacts[artifactId] =
                DocumentArtifact.parse({
                  id: artifactId,
                  assets: {
                    [asset.id]: DocumentAsset.parse({
                      ...asset,
                      createdAt: asset.createdAt ?? timestamp,
                      updatedAt: asset.updatedAt ?? timestamp,
                    }),
                  },
                  updatedAt: timestamp,
                });
              return;
            }

            const existingAsset = existingDocument.assets[asset.id];
            existingDocument.assets[asset.id] = DocumentAsset.parse({
              ...asset,
              createdAt:
                asset.createdAt ?? existingAsset?.createdAt ?? timestamp,
              updatedAt: asset.updatedAt ?? timestamp,
            });
            existingDocument.updatedAt = timestamp;
          }),
        );
      },

      removeAsset(artifactId, assetId) {
        set((state) =>
          produce(state, (draft) => {
            const existingDocument =
              draft.documents.config.artifacts[artifactId];
            if (!existingDocument?.assets[assetId]) return;
            delete existingDocument.assets[assetId];
            existingDocument.updatedAt = now();
          }),
        );
      },

      getAsset(artifactId, assetId) {
        return get().documents.config.artifacts[artifactId]?.assets[assetId];
      },

      getDocument(artifactId) {
        return get().documents.config.artifacts[artifactId];
      },
    },
  }));
}
