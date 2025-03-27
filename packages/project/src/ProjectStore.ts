import {castDraft, produce} from 'immer';
import {StateCreator, StoreApi, createStore} from 'zustand';
import {useBaseProjectStore} from './ProjectStateProvider';

export type ProjectStore<PC> = StoreApi<ProjectState<PC>>;

export type ProjectStateProps<PC> = {
  lastSavedConfig: PC | undefined;
};

export type ProjectStateActions<PC> = {
  initialize: () => Promise<void>;

  /**
   * Set the project config.
   * @param config - The project config to set.
   */
  setProjectConfig: (config: PC) => void;
  /**
   * Set the last saved project config. This can be used to check if the project has unsaved changes.
   * @param config - The project config to set.
   */
  setLastSavedConfig: (config: PC) => void;
  /**
   * Check if the project has unsaved changes.
   * @returns True if the project has unsaved changes, false otherwise.
   */
  hasUnsavedChanges(): boolean; // since last save
};

export type ProjectState<PC> = {
  config: PC;
  project: ProjectStateProps<PC> & ProjectStateActions<PC>;
};

/**
 * Create a project store with custom fields and methods
 * @param initialState - The initial state and config for the project
 * @param sliceCreators - The slices to add to the project store
 * @returns The project store and a hook for accessing the project store
 */
export function createProjectStore<PC, AppState extends ProjectState<PC>>(
  stateCreator: StateCreator<AppState>,
) {
  const projectStore = createStore<AppState>((set, get, store) => ({
    ...stateCreator(set, get, store),
  }));
  projectStore.getState().project.initialize();

  function useProjectStore<T>(selector: (state: AppState) => T): T {
    // @ts-ignore TODO fix typing
    return useBaseProjectStore(selector as (state: AppState) => T);
  }

  return {projectStore, useProjectStore};
}

export function createProjectSlice<PC>(props: {
  config: PC;
  project: Partial<Omit<ProjectStateProps<PC>, 'config'>>;
}): StateCreator<ProjectState<PC>> {
  const {
    config: initialConfig,
    project: projectStateProps,
    ...restState
  } = props;
  const initialProjectState: ProjectStateProps<PC> = {
    ...projectStateProps,
    lastSavedConfig: undefined,
  };
  const slice: StateCreator<ProjectState<PC>> = (set, get) => {
    const projectState: ProjectState<PC> = {
      config: initialConfig,
      project: {
        ...initialProjectState,
        initialize: async () => {
          // To be overridden by the project builder
        },

        setProjectConfig: (config) =>
          set((state) =>
            produce(state, (draft) => {
              draft.config = castDraft(config);
            }),
          ),
        setLastSavedConfig: (config) =>
          set((state) =>
            produce(state, (draft) => {
              draft.project.lastSavedConfig = castDraft(config);
            }),
          ),

        hasUnsavedChanges: () => {
          const {lastSavedConfig} = get().project;
          const {config} = get();
          return config !== lastSavedConfig;
        },
      },
      ...restState,
    };

    return projectState;
  };

  return slice;
}
