import {createId} from '@paralleldrive/cuid2';
import type {LayoutSliceState} from '@sqlrooms/layout';
import {
  BaseRoomStoreState,
  createSlice,
  SliceFunctions,
  useBaseRoomStore,
} from '@sqlrooms/room-store';
import {produce} from 'immer';
import type {StoreApi} from 'zustand';
import type {ArtifactTypeDefinitions} from './ArtifactTypes';
import type {
  ArtifactMetadata as ArtifactMetadataType,
  ArtifactsSliceConfig as ArtifactsSliceConfigType,
} from './ArtifactsSliceConfig';
import {ArtifactMetadata, ArtifactsSliceConfig} from './ArtifactsSliceConfig';
import {normalizeOrder} from './helpers';

function createDefaultArtifactsConfig(
  overrides?: Partial<ArtifactsSliceConfigType>,
): ArtifactsSliceConfigType {
  return ArtifactsSliceConfig.parse(overrides ?? {});
}

export type ArtifactsSliceState = {
  artifacts: SliceFunctions & {
    config: ArtifactsSliceConfigType;
    artifactTypes: ArtifactTypeDefinitions<any>;
    setConfig: (config: ArtifactsSliceConfigType) => void;
    createArtifact: (
      artifact: Omit<ArtifactMetadataType, 'id' | 'title'> & {
        id?: string;
        title?: string;
      },
    ) => string;
    ensureArtifact: (
      id: string,
      artifact: Omit<ArtifactMetadataType, 'id' | 'title'> & {title?: string},
    ) => void;
    renameArtifact: (id: string, title: string) => void;
    closeArtifact: (id: string) => void;
    deleteArtifact: (id: string) => void;
    setCurrentArtifact: (id?: string) => void;
    setArtifactOrder: (artifactOrder: string[]) => void;
    getArtifact: (id: string) => ArtifactMetadataType | undefined;
  };
};

export type CreateArtifactsSliceProps<
  TRoomState extends BaseRoomStoreState = BaseRoomStoreState,
> = {
  config?: Partial<ArtifactsSliceConfigType>;
  artifactTypes?: ArtifactTypeDefinitions<TRoomState>;
};

type ArtifactsRootState = BaseRoomStoreState & ArtifactsSliceState;

function getArtifactTypeDefinition(
  artifactTypes: ArtifactTypeDefinitions<any>,
  type: string,
) {
  return artifactTypes[type];
}

function getArtifactTitle(
  artifactTypes: ArtifactTypeDefinitions<any>,
  type: string,
  title?: string,
) {
  const typeDefinition = getArtifactTypeDefinition(artifactTypes, type);
  return (
    title ?? typeDefinition?.defaultTitle ?? typeDefinition?.label ?? 'Untitled'
  );
}

function assertKnownArtifactType(
  artifactTypes: ArtifactTypeDefinitions<any>,
  type: string,
) {
  if (Object.keys(artifactTypes).length === 0 || artifactTypes[type]) {
    return;
  }
  throw new Error(`Unknown artifact type "${type}".`);
}

export function createArtifactsSlice<
  TRoomState extends ArtifactsRootState = ArtifactsRootState,
>(props: CreateArtifactsSliceProps<TRoomState> = {}) {
  const artifactTypes = props.artifactTypes ?? {};

  return createSlice<ArtifactsSliceState, TRoomState>((set, get, store) => ({
    artifacts: {
      config: createDefaultArtifactsConfig(props.config),
      artifactTypes,

      setConfig(config) {
        set((state) =>
          produce(state, (draft) => {
            draft.artifacts.config = ArtifactsSliceConfig.parse(config);
          }),
        );
      },

      createArtifact(artifact) {
        assertKnownArtifactType(artifactTypes, artifact.type);
        const id = artifact.id ?? createId();
        const next = ArtifactMetadata.parse({
          id,
          type: artifact.type,
          title: getArtifactTitle(artifactTypes, artifact.type, artifact.title),
        });
        set((state) =>
          produce(state, (draft) => {
            draft.artifacts.config.artifactsById[id] = next;
            if (!draft.artifacts.config.artifactOrder.includes(id)) {
              draft.artifacts.config.artifactOrder.push(id);
            }
            draft.artifacts.config.currentArtifactId = id;
          }),
        );
        const context = {
          artifactId: id,
          artifact: next,
          store: store as StoreApi<TRoomState>,
        };
        artifactTypes[next.type]?.onCreate?.(context);
        return id;
      },

      ensureArtifact(id, artifact) {
        assertKnownArtifactType(artifactTypes, artifact.type);
        const next = ArtifactMetadata.parse({
          id,
          type: artifact.type,
          title: getArtifactTitle(artifactTypes, artifact.type, artifact.title),
        });
        set((state) =>
          produce(state, (draft) => {
            const current = draft.artifacts.config.artifactsById[id];
            if (
              current?.type === next.type &&
              current.title === next.title &&
              draft.artifacts.config.artifactOrder.includes(id)
            ) {
              return;
            }
            draft.artifacts.config.artifactsById[id] = next;
            draft.artifacts.config.artifactOrder = normalizeOrder(
              draft.artifacts.config.artifactsById,
              draft.artifacts.config.artifactOrder,
            );
          }),
        );
        artifactTypes[next.type]?.onEnsure?.({
          artifactId: id,
          artifact: next,
          store: store as StoreApi<TRoomState>,
        });
      },

      renameArtifact(id, title) {
        const previous = get().artifacts.config.artifactsById[id];
        set((state) =>
          produce(state, (draft) => {
            const artifact = draft.artifacts.config.artifactsById[id];
            if (!artifact) return;
            artifact.title = title;
          }),
        );
        const next = get().artifacts.config.artifactsById[id];
        if (!previous || !next || previous.title === title) return;
        artifactTypes[next.type]?.onRename?.({
          artifactId: id,
          artifact: next,
          previousTitle: previous.title,
          store: store as StoreApi<TRoomState>,
        });
      },

      closeArtifact(id) {
        const artifact = get().artifacts.config.artifactsById[id];
        if (!artifact) return;
        artifactTypes[artifact.type]?.onClose?.({
          artifactId: id,
          artifact,
          store: store as StoreApi<TRoomState>,
        });
      },

      deleteArtifact(id) {
        const artifact = get().artifacts.config.artifactsById[id];
        if (!artifact) return;
        const context = {
          artifactId: id,
          artifact,
          store: store as StoreApi<TRoomState>,
        };
        artifactTypes[artifact.type]?.onClose?.(context);
        artifactTypes[artifact.type]?.onDelete?.(context);
        set((state) =>
          produce(state, (draft) => {
            delete draft.artifacts.config.artifactsById[id];
            draft.artifacts.config.artifactOrder =
              draft.artifacts.config.artifactOrder.filter(
                (candidate: string) => candidate !== id,
              );
            if (draft.artifacts.config.currentArtifactId === id) {
              draft.artifacts.config.currentArtifactId =
                draft.artifacts.config.artifactOrder[0];
            }
          }),
        );
      },

      setCurrentArtifact(id) {
        set((state) =>
          produce(state, (draft) => {
            draft.artifacts.config.currentArtifactId =
              id && draft.artifacts.config.artifactsById[id] ? id : undefined;
          }),
        );
      },

      setArtifactOrder(artifactOrder) {
        set((state) =>
          produce(state, (draft) => {
            draft.artifacts.config.artifactOrder = normalizeOrder(
              draft.artifacts.config.artifactsById,
              artifactOrder,
            );
            if (
              draft.artifacts.config.currentArtifactId &&
              !draft.artifacts.config.artifactsById[
                draft.artifacts.config.currentArtifactId
              ]
            ) {
              draft.artifacts.config.currentArtifactId =
                draft.artifacts.config.artifactOrder[0];
            }
          }),
        );
      },

      getArtifact(id) {
        return get().artifacts.config.artifactsById[id];
      },
    },
  }));
}

export type RoomStateWithArtifacts = BaseRoomStoreState & ArtifactsSliceState;
export type RoomStateWithArtifactsAndLayout = RoomStateWithArtifacts &
  LayoutSliceState;

export function useStoreWithArtifacts<T>(
  selector: (state: RoomStateWithArtifacts) => T,
): T {
  return useBaseRoomStore<RoomStateWithArtifacts, T>((state) =>
    selector(state as unknown as RoomStateWithArtifacts),
  );
}

export function useStoreWithArtifactsAndLayout<T>(
  selector: (state: RoomStateWithArtifactsAndLayout) => T,
): T {
  return useBaseRoomStore<RoomStateWithArtifactsAndLayout, T>((state) =>
    selector(state as unknown as RoomStateWithArtifactsAndLayout),
  );
}
