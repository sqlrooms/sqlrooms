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

/** Runtime schema for a durable Deck map resource entry. */
export const DeckMapResourceSchema = z.object({
  id: z.string(),
  title: z.string(),
  selectedTable: z.string().optional(),
  config: DeckMapConfigSchema,
});

/** A durable Deck map resource stored in the room configuration. */
export type DeckMapResource = Omit<
  z.infer<typeof DeckMapResourceSchema>,
  'config'
> & {
  config: DeckMapConfig;
};

/** Persistence schema for the Deck maps slice configuration. */
export const DeckMapsSliceConfig = z.object({
  mapsById: z.record(z.string(), DeckMapResourceSchema).default({}),
});

/** Persisted Deck map resources indexed by their stable resource ids. */
export type DeckMapsSliceConfig = {
  mapsById: Record<string, DeckMapResource>;
};

/** Ephemeral rendering or data issue associated with one Deck map resource. */
export type DeckMapRuntimeIssue = {
  kind: 'sql-error' | 'render-error' | 'data-policy-error' | 'config-error';
  mapId: string;
  message: string;
  recoverable: boolean;
  details?: Record<string, unknown>;
};

/** Callback pair for reporting and clearing ephemeral Deck map issues. */
export type DeckMapRuntimeIssueReporter = {
  reportIssue: (issue: DeckMapRuntimeIssue) => void;
  clearIssue: () => void;
};

/** Room-store state and actions for durable maps and ephemeral runtime issues. */
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
    getMap: (id: string) => DeckMapResource | undefined;
    updateMap: (id: string, patch: Partial<DeckMapResource>) => void;
    setSelectedTable: (id: string, tableName?: string) => void;
    reportMapIssue: (
      id: string,
      issue: Omit<DeckMapRuntimeIssue, 'mapId'>,
    ) => void;
    /** Clears the current issue when its kind matches, or unconditionally when omitted. */
    clearMapIssue: (id: string, kind?: DeckMapRuntimeIssue['kind']) => void;
  };
};

/**
 * Creates the room-store slice that owns durable Deck map resources and their
 * instance-scoped runtime issues.
 */
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
            if (patch.config) {
              const issue = draft.deckMaps.runtime.issuesByMapId[id];
              if (
                Object.keys(patch.config.datasets).length === 0 ||
                issue?.kind === 'render-error'
              ) {
                delete draft.deckMaps.runtime.issuesByMapId[id];
              }
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
      clearMapIssue: (id, kind) =>
        set((state) =>
          produce(state, (draft) => {
            const issue = draft.deckMaps.runtime.issuesByMapId[id];
            if (!kind || issue?.kind === kind) {
              delete draft.deckMaps.runtime.issuesByMapId[id];
            }
          }),
        ),
    },
  }));
}

/** Selects Deck map and DuckDB state from the current room store. */
export function useStoreWithDeckMaps<T>(
  selector: (state: DeckMapsSliceState & DuckDbSliceState) => T,
): T {
  return useBaseRoomStore<DeckMapsSliceState & DuckDbSliceState, T>(selector);
}
