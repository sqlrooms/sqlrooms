import {castDraft, produce} from 'immer';
import {StateCreator, StoreApi, createStore} from 'zustand';
import {useBaseProjectStore} from './ProjectStateProvider';

export type ProjectStore<PC> = StoreApi<ProjectState<PC>>;

export type ProjectStateProps<PC> = {
  lastSavedConfig: PC | undefined;
  tasksProgress: Record<string, TaskProgress>;
  projectError: Error | undefined;
  captureException: (exception: unknown, captureContext?: unknown) => void;
};

export type TaskProgress = {
  progress?: number | undefined;
  message: string;
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

  /**
   * Called when the project config is saved. To be overridden by the custom project state.
   * @param config - The project config to save.
   */
  onSaveConfig?: (config: PC) => void;

  setTaskProgress: (id: string, taskProgress: TaskProgress | undefined) => void;
  getLoadingProgress: () => TaskProgress | undefined;
  setProjectError: (error: Error) => void;
};

export type ProjectState<PC> = {
  config: PC;
  project: ProjectStateProps<PC> & ProjectStateActions<PC>;
};

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
    tasksProgress: {},
    projectError: undefined,
    captureException: (exception: unknown) => {
      console.error(exception);
    },
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

        /** Returns the progress of the last task */
        getLoadingProgress() {
          const {tasksProgress} = get().project;
          const keys = Object.keys(tasksProgress);
          const lastKey = keys[keys.length - 1];
          if (lastKey) {
            return tasksProgress[lastKey];
          }
          return undefined;
        },

        setProjectError(error) {
          set((state) =>
            produce(state, (draft) => {
              draft.project.projectError = error;
            }),
          );
        },
        
        setTaskProgress(id, taskProgress) {
          set((state) =>
            produce(state, (draft) => {
              if (taskProgress) {
                draft.project.tasksProgress[id] = taskProgress;
              } else {
                delete draft.project.tasksProgress[id];
              }
            }),
          );
        },
      },
      ...restState,
    };

    return projectState;
  };

  return slice;
}

export function createBaseSlice<PC, S>(
  sliceCreator: (...args: Parameters<StateCreator<S & ProjectState<PC>>>) => S,
): StateCreator<S> {
  return (set, get, store) =>
    sliceCreator(
      set,
      get as () => S & ProjectState<PC>,
      store as StoreApi<S & ProjectState<PC>>,
    );
}

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

  if (typeof window !== 'undefined') {
    Object.values(projectStore.getState()).forEach((slice) => {
      const initializeSlice = (slice as Record<string, unknown>).initialize;
      if (typeof initializeSlice === 'function') {
        initializeSlice();
      }
    });
  } else {
    console.warn(
      'Skipping project store initialization. Project store should be only used on client.',
    );
  }
  projectStore.subscribe((state) => {
    try {
      if (state.project.onSaveConfig && state.project.hasUnsavedChanges()) {
        state.project.onSaveConfig(state.config);
        state.project.setLastSavedConfig(state.config);
      }
    } catch (error) {
      state.project.captureException(error);
      state.project.setProjectError(new Error('Error saving project config', {cause: error}));
    }
  });

  function useProjectStore<T>(selector: (state: AppState) => T): T {
    // @ts-ignore TODO fix typing
    return useBaseProjectStore(selector as (state: AppState) => T);
  }
  return {projectStore, useProjectStore};
}
