import {produce} from 'immer';
import {createStore, type StoreApi} from 'zustand/vanilla';

/**
 * The serializable half of the draft — the parts the agent's tools fill in.
 * `id` and `version` are deliberately omitted: the host derives them at save
 * time (id from the name via slug + collision resolution; version defaulted).
 */
export interface SkillDraft {
  name: string;
  description: string;
  author: string;
  instructions: string;
}

/**
 * Save status lifecycle. Transitions: `'idle' → 'saving' → 'saved' | 'error'`.
 * A retry from `'error'` is `'error' → 'saving' → ...`.
 */
export type SkillDraftStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface SkillDraftState extends SkillDraft {
  status: SkillDraftStatus;
  error?: string;
  patchManifest(
    patch: Partial<Pick<SkillDraft, 'name' | 'description' | 'author'>>,
  ): void;
  setInstructions(markdown: string): void;
  setStatus(status: SkillDraftStatus, error?: string): void;
  reset(): void;
}

export type SkillDraftStore = StoreApi<SkillDraftState>;

const initialDraft: SkillDraft = {
  name: '',
  description: '',
  author: '',
  instructions: '',
};

/**
 * Create a fresh per-session draft store. The authoring wizard is ephemeral:
 * each dialog open calls this factory, and the store is discarded on close.
 * Exporting a singleton hook would leak draft state across sessions and is
 * deliberately avoided.
 */
export function createSkillDraftStore(): SkillDraftStore {
  return createStore<SkillDraftState>((set) => ({
    ...initialDraft,
    status: 'idle',
    error: undefined,

    patchManifest: (patch) =>
      set((state) =>
        produce(state, (draft) => {
          if (patch.name !== undefined) draft.name = patch.name;
          if (patch.description !== undefined)
            draft.description = patch.description;
          if (patch.author !== undefined) draft.author = patch.author;
        }),
      ),

    setInstructions: (markdown) =>
      set((state) =>
        produce(state, (draft) => {
          draft.instructions = markdown;
        }),
      ),

    setStatus: (status, error) =>
      set((state) =>
        produce(state, (draft) => {
          draft.status = status;
          draft.error = status === 'error' ? error : undefined;
        }),
      ),

    reset: () =>
      set((state) =>
        produce(state, (draft) => {
          draft.name = initialDraft.name;
          draft.description = initialDraft.description;
          draft.author = initialDraft.author;
          draft.instructions = initialDraft.instructions;
          draft.status = 'idle';
          draft.error = undefined;
        }),
      ),
  }));
}
