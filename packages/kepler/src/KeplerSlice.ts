import {registerEntry, requestMapStyles} from '@kepler.gl/actions';
import keplerGlReducer, {KeplerGlState} from '@kepler.gl/reducers';
import {createId} from '@paralleldrive/cuid2';
import {
  createSlice,
  ProjectBuilderState,
  useBaseProjectBuilderStore,
  type StateCreator,
} from '@sqlrooms/project-builder';
import {BaseProjectConfig} from '@sqlrooms/project-config';
import {produce} from 'immer';
import {taskMiddleware} from 'react-palm/tasks';
import {z} from 'zod';
import {createLogger, ReduxLoggerOptions} from 'redux-logger';
import type {Store as ReduxStore} from 'redux';

export const KeplerMapSchema = z.object({
  id: z.string(),
  name: z.string(),
  // ...
});
export type KeplerMapSchema = z.infer<typeof KeplerMapSchema>;

export type CreateKeplerSliceOptions = {
  actionLogging?: boolean | ReduxLoggerOptions;
};

export const KeplerSliceConfig = z.object({
  kepler: z.object({
    currentMapId: z.string(),
    maps: z.array(KeplerMapSchema),
  }),
});
export type KeplerSliceConfig = z.infer<typeof KeplerSliceConfig>;

export function createDefaultKeplerConfig(
  props?: Partial<KeplerSliceConfig['kepler']>,
): KeplerSliceConfig {
  const defaultMapId = createId();
  return {
    kepler: {
      maps: [
        {
          id: defaultMapId,
          name: 'Untitled Map',
        },
      ],
      currentMapId: defaultMapId,
      ...props,
    },
  };
}

export type KeplerAction = {
  type: string;
  payload: unknown;
};

export type KeplerSliceState = {
  kepler: {
    map: KeplerGlState;
    dispatchAction: (action: KeplerAction) => void;
    setCurrentMapId: (mapId: string) => void;
    createMap: (name?: string) => void;
    deleteMap: (mapId: string) => void;
    renameMap: (mapId: string, name: string) => void;
    getCurrentMap: () => KeplerMapSchema | undefined;
    __reduxProviderStore: ReduxStore<KeplerGlState, KeplerAction>;
  };
};

export function createKeplerSlice<
  PC extends BaseProjectConfig & KeplerSliceConfig,
>(options: CreateKeplerSliceOptions = {}): StateCreator<KeplerSliceState> {
  const {actionLogging = false} = options;
  return createSlice<PC, KeplerSliceState>((set, get) => {
    const keplerReducer = keplerGlReducer.initialState({
      visState: {
        layerClasses: [],
      },
      mapStyle: {
        styleType: 'positron',
      },
    });

    const keplerInitialState: {map: KeplerGlState} = keplerReducer(
      undefined,
      registerEntry({id: 'map'}),
    );

    const dispatch = (action: KeplerAction) => {
      set((state: KeplerSliceState) => ({
        ...state,
        kepler: {
          ...state.kepler,
          ...keplerReducer({map: state.kepler.map}, action),
        },
      }));
      return action;
    };

    const middleware = [taskMiddleware];
    if (actionLogging) {
      const logger = createLogger(
        actionLogging === true ? {collapsed: true} : actionLogging,
      );
      middleware.push(logger);
    }
    const dispatchWithMiddleware = (action: KeplerAction) => {
      middleware.forEach((m) =>
        m({dispatch, getState: () => get().kepler.map})(dispatch)(action),
      );
      dispatch(action);
      return action;
    };

    const __reduxProviderStore: ReduxStore<KeplerGlState, KeplerAction> = {
      // @ts-ignore
      dispatch: dispatchWithMiddleware,
      getState: () => get().kepler.map,
      subscribe: () => () => {},
      replaceReducer: () => {},
      // @ts-ignore
      [Symbol.observable]: () => {},
    };

    return {
      kepler: {
        ...keplerInitialState,
        dispatchAction: dispatchWithMiddleware,
        __reduxProviderStore,

        initialize: () => {
          const {mapStyle} = get().kepler.map;
          const style = mapStyle.mapStyles[mapStyle.styleType];
          if (style) {
            get().kepler.dispatchAction(requestMapStyles({[style.id]: style}));
          }
        },

        getCurrentMap: () => {
          return get().config.kepler.maps.find(
            (map) => map.id === get().config.kepler.currentMapId,
          );
        },
        setCurrentMapId: (mapId: string) => {
          return set((state) =>
            produce(state, (draft) => {
              draft.config.kepler.currentMapId = mapId;
            }),
          );
        },
        createMap: (name?: string) => {
          const mapId = createId();
          set((state) =>
            produce(state, (draft) => {
              draft.config.kepler.maps.push({
                id: mapId,
                name: name ?? 'Untitled Map',
              });
            }),
          );
        },
        deleteMap: (mapId: string) => {
          set((state) =>
            produce(state, (draft) => {
              draft.config.kepler.maps = draft.config.kepler.maps.filter(
                (map) => map.id !== mapId,
              );
            }),
          );
        },
        renameMap: (mapId: string, name: string) => {
          set((state) =>
            produce(state, (draft) => {
              const map = draft.config.kepler.maps.find(
                (map) => map.id === mapId,
              );
              if (map) {
                map.name = name;
              }
            }),
          );
        },
      },
    };
  });
}

type ProjectConfigWithKepler = BaseProjectConfig & KeplerSliceConfig;
type ProjectStateWithKepler = ProjectBuilderState<ProjectConfigWithKepler> &
  KeplerSliceState;

export function useStoreWithKepler<T>(
  selector: (state: ProjectStateWithKepler) => T,
): T {
  return useBaseProjectBuilderStore<
    BaseProjectConfig & KeplerSliceConfig,
    ProjectBuilderState<ProjectConfigWithKepler>,
    T
  >((state) => selector(state as unknown as ProjectStateWithKepler));
}
