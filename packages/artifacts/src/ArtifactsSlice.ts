import {createId} from '@paralleldrive/cuid2';
import {
  BaseRoomStoreState,
  createSlice,
  SliceFunctions,
  useBaseRoomStore,
} from '@sqlrooms/room-store';
import {produce} from 'immer';
import type {
  ArtifactEntry as ArtifactEntryType,
  ArtifactsSliceConfig as ArtifactsSliceConfigType,
} from './ArtifactsSliceConfig';
import {ArtifactEntry, ArtifactsSliceConfig} from './ArtifactsSliceConfig';
import {normalizeOrder} from './helpers';

function createDefaultArtifactsConfig(
  overrides?: Partial<ArtifactsSliceConfigType>,
): ArtifactsSliceConfigType {
  return ArtifactsSliceConfig.parse(overrides ?? {});
}

export type ArtifactsSliceState = {
  artifacts: SliceFunctions & {
    config: ArtifactsSliceConfigType;
    setConfig: (config: ArtifactsSliceConfigType) => void;
    addItem: (item: Omit<ArtifactEntryType, 'id'> & {id?: string}) => string;
    ensureItem: (id: string, item: Omit<ArtifactEntryType, 'id'>) => void;
    renameItem: (id: string, title: string) => void;
    removeItem: (id: string) => void;
    setCurrentItem: (id?: string) => void;
    setOrder: (order: string[]) => void;
    getItem: (id: string) => ArtifactEntryType | undefined;
  };
};

export type CreateArtifactsSliceProps = {
  config?: Partial<ArtifactsSliceConfigType>;
};

type ArtifactsRootState = BaseRoomStoreState & ArtifactsSliceState;

export function createArtifactsSlice(props: CreateArtifactsSliceProps = {}) {
  return createSlice<ArtifactsSliceState, ArtifactsRootState>((set, get) => ({
    artifacts: {
      config: createDefaultArtifactsConfig(props.config),

      setConfig(config) {
        set((state) =>
          produce(state, (draft) => {
            draft.artifacts.config = ArtifactsSliceConfig.parse(config);
          }),
        );
      },

      addItem(item) {
        const id = item.id ?? createId();
        const next = ArtifactEntry.parse({
          id,
          type: item.type,
          title: item.title,
        });
        set((state) =>
          produce(state, (draft) => {
            draft.artifacts.config.itemsById[id] = next;
            if (!draft.artifacts.config.order.includes(id)) {
              draft.artifacts.config.order.push(id);
            }
            draft.artifacts.config.currentItemId = id;
          }),
        );
        return id;
      },

      ensureItem(id, item) {
        const next = ArtifactEntry.parse({
          id,
          type: item.type,
          title: item.title,
        });
        set((state) =>
          produce(state, (draft) => {
            draft.artifacts.config.itemsById[id] = next;
            draft.artifacts.config.order = normalizeOrder(
              draft.artifacts.config.itemsById,
              draft.artifacts.config.order,
            );
          }),
        );
      },

      renameItem(id, title) {
        set((state) =>
          produce(state, (draft) => {
            const item = draft.artifacts.config.itemsById[id];
            if (!item) return;
            item.title = title;
          }),
        );
      },

      removeItem(id) {
        set((state) =>
          produce(state, (draft) => {
            delete draft.artifacts.config.itemsById[id];
            draft.artifacts.config.order = draft.artifacts.config.order.filter(
              (candidate: string) => candidate !== id,
            );
            if (draft.artifacts.config.currentItemId === id) {
              draft.artifacts.config.currentItemId =
                draft.artifacts.config.order[0];
            }
          }),
        );
      },

      setCurrentItem(id) {
        set((state) =>
          produce(state, (draft) => {
            draft.artifacts.config.currentItemId =
              id && draft.artifacts.config.itemsById[id] ? id : undefined;
          }),
        );
      },

      setOrder(order) {
        set((state) =>
          produce(state, (draft) => {
            draft.artifacts.config.order = normalizeOrder(
              draft.artifacts.config.itemsById,
              order,
            );
            if (
              draft.artifacts.config.currentItemId &&
              !draft.artifacts.config.itemsById[
                draft.artifacts.config.currentItemId
              ]
            ) {
              draft.artifacts.config.currentItemId =
                draft.artifacts.config.order[0];
            }
          }),
        );
      },

      getItem(id) {
        return get().artifacts.config.itemsById[id];
      },
    },
  }));
}

type RoomStateWithArtifacts = BaseRoomStoreState & ArtifactsSliceState;

export function useStoreWithArtifacts<T>(
  selector: (state: RoomStateWithArtifacts) => T,
): T {
  return useBaseRoomStore<RoomStateWithArtifacts, T>((state) =>
    selector(state as unknown as RoomStateWithArtifacts),
  );
}
