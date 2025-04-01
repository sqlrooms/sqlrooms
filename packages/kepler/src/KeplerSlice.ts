import {
  deleteEntry,
  registerEntry,
  requestMapStyles,
  wrapTo,
} from '@kepler.gl/actions';
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

const defaultMapId = 'untitled_map';

export function createDefaultKeplerConfig(
  props?: Partial<KeplerSliceConfig['kepler']>,
): KeplerSliceConfig {
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
// support multiple kepler maps
export type KeplerGlReduxState = {[id: string]: KeplerGlState};
export type KeplerSliceState = {
  kepler: {
    map: KeplerGlReduxState;
    dispatchAction: (mapId: string, action: KeplerAction) => void;
    setCurrentMapId: (mapId: string) => void;
    createMap: (name?: string) => void;
    deleteMap: (mapId: string) => void;
    renameMap: (mapId: string, name: string) => void;
    getCurrentMap: () => KeplerMapSchema | undefined;
    __reduxProviderStore: ReduxStore<KeplerGlReduxState, KeplerAction>;
  };
};

export function createKeplerSlice<
  PC extends BaseProjectConfig & KeplerSliceConfig,
>(options: CreateKeplerSliceOptions = {}): StateCreator<KeplerSliceState> {
  const {actionLogging = false} = options;
  return createSlice<PC, KeplerSliceState>((set, get) => {
    const keplerReducer = keplerGlReducer.initialState({
      mapStyle: {
        styleType: 'positron',
      },
    });

    const keplerInitialState: KeplerGlReduxState = keplerReducer(
      undefined,
      registerEntry({id: defaultMapId}),
    );

    const dispatch = (mapId: string, action: KeplerAction) => {
      set((state: KeplerSliceState) => ({
        ...state,
        kepler: {
          ...state.kepler,
          map: keplerReducer(state.kepler.map, wrapTo(mapId, action)),
        },
      }));
      return action;
    };

    // forward kepler action to default map
    const middleware = [taskMiddleware];
    if (actionLogging) {
      const logger = createLogger(
        actionLogging === true ? {collapsed: true} : actionLogging,
      );
      middleware.push(logger);
    }
    const dispatchWithMiddleware = (mapId: string, action: KeplerAction) => {
      const wrapDispatch = (a: KeplerAction) => dispatch(mapId, a);
      middleware.forEach((m) =>
        m({
          dispatch: wrapDispatch,
          getState: () => get().kepler.map,
        })(wrapDispatch)(action),
      );
      dispatch(mapId, action);
      return action;
    };

    const __reduxProviderStore: ReduxStore<KeplerGlReduxState, KeplerAction> = {
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
        map: keplerInitialState,
        dispatchAction: dispatchWithMiddleware,
        __reduxProviderStore,

        initialize: () => {
          const {mapStyle} = get().kepler.map[defaultMapId] || {};
          const style = mapStyle?.mapStyles[mapStyle.styleType];
          if (style) {
            get().kepler.dispatchAction(
              defaultMapId,
              requestMapStyles({[style.id]: style}),
            );
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
          set((state) => {
            return produce(state, (draft) => {
              draft.config.kepler.maps.push({
                id: mapId,
                name: name ?? 'Untitled Map',
              });
              draft.kepler.map = keplerReducer(
                draft.kepler.map,
                registerEntry({id: mapId}),
              );
            });
          });
        },
        deleteMap: (mapId: string) => {
          set((state) =>
            produce(state, (draft) => {
              draft.config.kepler.maps = draft.config.kepler.maps.filter(
                (map) => map.id !== mapId,
              );
              draft.kepler.map = keplerReducer(
                draft.kepler.map,
                deleteEntry(mapId),
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
        addDataToMap: (mapId: string, data: string) => {
          // take a SQL query
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
