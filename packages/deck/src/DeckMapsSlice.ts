import {type DuckDbSliceState} from '@sqlrooms/duckdb';
import {
  type BaseRoomStoreState,
  createSlice,
  useBaseRoomStore,
} from '@sqlrooms/room-store';
import {produce} from 'immer';
import {z} from 'zod';
import {createEmptyDeckMapConfig, type DeckMapConfig} from './mapConfig';

const DeckMapConfigSchema = z.object({
  spec: z.union([z.string(), z.record(z.string(), z.unknown())]),
  datasets: z.record(z.string(), z.unknown()),
  configMode: z.enum(['basic', 'custom']).optional(),
  mapStyle: z.string().optional(),
  mapProps: z.record(z.string(), z.unknown()).optional(),
  showLegends: z.boolean().optional(),
  interaction: z.record(z.string(), z.unknown()).optional(),
  fitToData: z.record(z.string(), z.unknown()).optional(),
  dataPolicy: z.record(z.string(), z.unknown()).optional(),
  settingsOpen: z.boolean().optional(),
});

export const DeckMapEntrySchema = z.object({
  id: z.string(),
  title: z.string(),
  selectedTable: z.string().optional(),
  config: DeckMapConfigSchema,
});

export type DeckMapEntry = Omit<
  z.infer<typeof DeckMapEntrySchema>,
  'config'
> & {
  config: DeckMapConfig;
};

export const DeckMapsSliceConfig = z.object({
  mapsById: z.record(z.string(), DeckMapEntrySchema).default({}),
});
export type DeckMapsSliceConfig = {
  mapsById: Record<string, DeckMapEntry>;
};

export type DeckMapRuntimeIssue = {
  kind: 'sql-error' | 'render-error' | 'data-policy-error' | 'config-error';
  mapId: string;
  message: string;
  recoverable: boolean;
  details?: Record<string, unknown>;
};

export type DeckMapRuntimeIssueReporter = {
  reportIssue: (issue: DeckMapRuntimeIssue) => void;
  clearIssue: () => void;
};

export type DeckMapsSliceState = {
  deckMaps: {
    config: DeckMapsSliceConfig;
    runtime: {issuesByMapId: Record<string, DeckMapRuntimeIssue>};
    setConfig: (config: DeckMapsSliceConfig) => void;
    ensureMap: (
      id: string,
      options?: {title?: string; config?: DeckMapConfig},
    ) => void;
    removeMap: (id: string) => void;
    getMap: (id: string) => DeckMapEntry | undefined;
    updateMap: (id: string, patch: Partial<DeckMapEntry>) => void;
    setSelectedTable: (id: string, tableName?: string) => void;
    reportMapIssue: (
      id: string,
      issue: Omit<DeckMapRuntimeIssue, 'mapId'>,
    ) => void;
    clearMapIssue: (id: string) => void;
  };
};

export function createDeckMapsSlice(props?: {
  config?: Partial<DeckMapsSliceConfig>;
}) {
  type RootState = BaseRoomStoreState & DuckDbSliceState & DeckMapsSliceState;
  return createSlice<DeckMapsSliceState, RootState>((set, get) => ({
    deckMaps: {
      config: {mapsById: props?.config?.mapsById ?? {}},
      runtime: {issuesByMapId: {}},
      setConfig: (config) =>
        set((state) =>
          produce(state, (draft) => {
            draft.deckMaps.config = config;
          }),
        ),
      ensureMap: (id, options) =>
        set((state) =>
          produce(state, (draft) => {
            if (!draft.deckMaps.config.mapsById[id]) {
              draft.deckMaps.config.mapsById[id] = {
                id,
                title: options?.title ?? 'Map',
                config: options?.config ?? createEmptyDeckMapConfig(),
              };
            }
          }),
        ),
      removeMap: (id) =>
        set((state) =>
          produce(state, (draft) => {
            delete draft.deckMaps.config.mapsById[id];
            delete draft.deckMaps.runtime.issuesByMapId[id];
          }),
        ),
      getMap: (id) => get().deckMaps.config.mapsById[id],
      updateMap: (id, patch) =>
        set((state) =>
          produce(state, (draft) => {
            const map = draft.deckMaps.config.mapsById[id];
            if (!map) throw new Error(`Deck map ${id} was not found`);
            Object.assign(map, patch, {id});
            if (
              patch.config &&
              Object.keys(patch.config.datasets).length === 0
            ) {
              delete draft.deckMaps.runtime.issuesByMapId[id];
            }
          }),
        ),
      setSelectedTable: (id, tableName) =>
        set((state) =>
          produce(state, (draft) => {
            const map = draft.deckMaps.config.mapsById[id];
            if (!map) throw new Error(`Deck map ${id} was not found`);
            map.selectedTable = tableName;
          }),
        ),
      reportMapIssue: (id, issue) =>
        set((state) =>
          produce(state, (draft) => {
            draft.deckMaps.runtime.issuesByMapId[id] = {...issue, mapId: id};
          }),
        ),
      clearMapIssue: (id) =>
        set((state) =>
          produce(state, (draft) => {
            delete draft.deckMaps.runtime.issuesByMapId[id];
          }),
        ),
    },
  }));
}

export function useStoreWithDeckMaps<T>(
  selector: (state: DeckMapsSliceState & DuckDbSliceState) => T,
): T {
  return useBaseRoomStore<DeckMapsSliceState & DuckDbSliceState, T>(selector);
}
