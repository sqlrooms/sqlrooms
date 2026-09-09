import {BaseRoomStoreState, createSlice} from '@sqlrooms/room-store';
import {produce} from 'immer';
import {
  DocumentAsset,
  type DocumentAsset as DocumentAssetType,
} from './DocumentAsset';
import {
  MarkdownDocumentsSliceConfig,
  MarkdownDocumentState,
  type MarkdownDocumentsSliceConfig as MarkdownDocumentsSliceConfigType,
  type MarkdownDocumentState as MarkdownDocumentStateType,
} from './MarkdownDocumentsSliceConfig';

export type DocumentAssetInput = Omit<
  DocumentAssetType,
  'createdAt' | 'updatedAt'
> &
  Partial<Pick<DocumentAssetType, 'createdAt' | 'updatedAt'>>;

/** State and operations for artifact-scoped Markdown documents. */
export type MarkdownDocumentsSliceState = {
  markdownDocuments: {
    config: MarkdownDocumentsSliceConfigType;
    setConfig: (config: MarkdownDocumentsSliceConfigType) => void;
    ensureDocument: (artifactId: string, markdown?: string) => void;
    removeDocument: (artifactId: string) => void;
    setMarkdown: (artifactId: string, markdown: string) => void;
    upsertAsset: (artifactId: string, asset: DocumentAssetInput) => void;
    removeAsset: (artifactId: string, assetId: string) => void;
    getAsset: (
      artifactId: string,
      assetId: string,
    ) => DocumentAssetType | undefined;
    getDocument: (artifactId: string) => MarkdownDocumentStateType | undefined;
  };
};

/** Initial Markdown document state and optional clock. */
export type CreateMarkdownDocumentsSliceProps = {
  config?: Partial<MarkdownDocumentsSliceConfigType>;
  now?: () => number;
};

/** Creates validated default Markdown document configuration. */
export function createDefaultMarkdownDocumentsConfig(
  props: Partial<MarkdownDocumentsSliceConfigType> = {},
): MarkdownDocumentsSliceConfigType {
  return MarkdownDocumentsSliceConfig.parse({artifacts: {}, ...props});
}

/** Creates the Markdown document store slice. */
export function createMarkdownDocumentsSlice<
  TRoomState extends BaseRoomStoreState & MarkdownDocumentsSliceState,
>(props: CreateMarkdownDocumentsSliceProps = {}) {
  const now = props.now ?? Date.now;

  return createSlice<MarkdownDocumentsSliceState, TRoomState>((set, get) => ({
    markdownDocuments: {
      config: createDefaultMarkdownDocumentsConfig(props.config),

      setConfig(config) {
        set((state) =>
          produce(state, (draft) => {
            draft.markdownDocuments.config =
              MarkdownDocumentsSliceConfig.parse(config);
          }),
        );
      },

      ensureDocument(artifactId, markdown = '') {
        set((state) =>
          produce(state, (draft) => {
            if (draft.markdownDocuments.config.artifacts[artifactId]) return;
            draft.markdownDocuments.config.artifacts[artifactId] =
              MarkdownDocumentState.parse({
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
            delete draft.markdownDocuments.config.artifacts[artifactId];
          }),
        );
      },

      setMarkdown(artifactId, markdown) {
        set((state) =>
          produce(state, (draft) => {
            const existing =
              draft.markdownDocuments.config.artifacts[artifactId];
            if (existing) {
              existing.markdown = markdown;
              existing.updatedAt = now();
              return;
            }
            draft.markdownDocuments.config.artifacts[artifactId] =
              MarkdownDocumentState.parse({
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
              draft.markdownDocuments.config.artifacts[artifactId];
            if (!existingDocument) {
              draft.markdownDocuments.config.artifacts[artifactId] =
                MarkdownDocumentState.parse({
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
              draft.markdownDocuments.config.artifacts[artifactId];
            if (!existingDocument?.assets[assetId]) return;
            delete existingDocument.assets[assetId];
            existingDocument.updatedAt = now();
          }),
        );
      },

      getAsset(artifactId, assetId) {
        return get().markdownDocuments.config.artifacts[artifactId]?.assets[
          assetId
        ];
      },

      getDocument(artifactId) {
        return get().markdownDocuments.config.artifacts[artifactId];
      },
    },
  }));
}
