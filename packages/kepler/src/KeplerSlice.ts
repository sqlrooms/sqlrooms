import {createId} from '@paralleldrive/cuid2';
import {
  createSlice,
  ProjectState,
  useBaseProjectStore,
  type StateCreator,
} from '@sqlrooms/project-builder';
import {BaseProjectConfig} from '@sqlrooms/project-config';
import {produce} from 'immer';
import {z} from 'zod';
import {redux} from 'zustand/middleware';
import {registerEntry} from '@kepler.gl/actions';
import keplerGlReducer, {
  KeplerGlState,
  MapStyle,
  ProviderState,
} from '@kepler.gl/reducers';
import type {VisState} from '@kepler.gl/schemas';

export const KeplerMapSchema = z.object({
  id: z.string(),
  name: z.string(),
  // ...
});
export type KeplerMapSchema = z.infer<typeof KeplerMapSchema>;

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

export type KeplerSliceState = {
  kepler: {
    map: KeplerGlState;
    dispatchAction: (action: any) => void;
    setCurrentMapId: (mapId: string) => void;
    createMap: (name?: string) => void;
    deleteMap: (mapId: string) => void;
    renameMap: (mapId: string, name: string) => void;
    getCurrentMap: () => KeplerMapSchema | undefined;
  };
};

export function createKeplerSlice<
  PC extends BaseProjectConfig & KeplerSliceConfig,
>(): StateCreator<KeplerSliceState> {
  return createSlice<PC, KeplerSliceState>((set, get, store) => {
    const keplerReducer = keplerGlReducer.initialState({
      visState: {
        layerClasses: [],
      },
      mapStyle: {
        styleType: 'light',
      },
    });
    const {map, dispatch} = redux(
      keplerReducer,
      keplerReducer(undefined, registerEntry({id: 'map'})),
    )(set, get, store);

    return {
      kepler: {
        map: map as unknown as KeplerGlState,
        dispatchAction: dispatch,

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
type ProjectStateWithKepler = ProjectState<ProjectConfigWithKepler> &
  KeplerSliceState;

export function useStoreWithKepler<T>(
  selector: (state: ProjectStateWithKepler) => T,
): T {
  return useBaseProjectStore<
    BaseProjectConfig & KeplerSliceConfig,
    ProjectState<ProjectConfigWithKepler>,
    T
  >((state) => selector(state as unknown as ProjectStateWithKepler));
}
