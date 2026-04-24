import type {QueryHandle} from '@sqlrooms/duckdb';
import {createStore} from 'zustand/vanilla';
import {prepareDeckDataset} from '../prepare/prepareDeckDataset';
import {
  isSqlDatasetInput,
  type DeckDatasetInput,
  type PreparedDeckDatasetState,
} from '../types';
import {
  DEFAULT_MAX_PREPARED_DATASET_ENTRIES,
  cloneEntryWithConsumers,
  evictLruEntries,
  nextAccessTimestamp,
  resolvePreparedDatasetCacheKey,
  touchEntry,
} from './helpers';
import {resolveArrowTable} from './normalizeDatasets';
import type {
  PreparedDatasetCacheEntry,
  PreparedDatasetStoreOptions,
} from './types';

/**
 * Internal store state for the prepared-dataset cache.
 *
 * `DeckJsonMap` never talks to this shape directly; `usePreparedDatasetStates`
 * uses it as the backing state machine for preparation, reuse, and eviction.
 */
type PreparedDatasetStoreState = {
  /**
   * Cache keys currently referenced by each hook consumer.
   *
   * This lets the store update consumer memberships incrementally when a map's
   * dataset registry changes, instead of resetting all cache state.
   */
  consumerKeys: Record<string, string[]>;
  /**
   * Prepared entries keyed by resolved dataset identity.
   *
   * Keys are based on query/table identity plus geometry options, not dataset
   * id, so the same prepared result can be reused across multiple maps or
   * differently named datasets that point at the same underlying data.
   */
  entries: Record<string, PreparedDatasetCacheEntry>;
  /**
   * Ensure a cache entry exists for the given dataset key.
   *
   * If an entry already exists, this is a no-op other than touching its LRU
   * metadata. Otherwise the store creates a `loading` entry, resolves the
   * source table through DuckDB if needed, runs `prepareDeckDataset(...)`, and
   * stores the resulting `ready` or `error` state.
   */
  ensureEntry: (options: {
    cacheKey: string;
    datasetId: string;
    executeSql: (
      query: string,
      version?: number,
    ) => Promise<QueryHandle | null>;
    input: DeckDatasetInput;
  }) => void;
  /**
   * Remove all subscriptions for one hook consumer.
   *
   * This is called when a `DeckJsonMap` instance unmounts so the store can
   * release the consumer's references and allow now-unreferenced entries to be
   * evicted later.
   */
  removeConsumer: (consumerId: string) => void;
  /**
   * Reconcile the set of cache keys referenced by one hook consumer.
   *
   * This adds the consumer to newly needed entries, removes it from entries no
   * longer needed, and preserves existing entries in place so unrelated dataset
   * states do not get reset during prop changes.
   */
  syncConsumer: (consumerId: string, keys: string[]) => void;
  /**
   * Reconcile and ensure all prepared entries needed by one dataset registry.
   *
   * This is the store-level orchestration entrypoint used by
   * `usePreparedDatasetStates`. It computes cache keys for the current dataset
   * registry, syncs consumer memberships, and eagerly ensures any resolvable
   * entries exist.
   */
  syncDatasetsForConsumer: (options: {
    consumerId: string;
    datasets: Record<string, DeckDatasetInput>;
    executeSql: (
      query: string,
      version?: number,
    ) => Promise<QueryHandle | null>;
    sqlSourceIdentity: object;
  }) => void;
};

type PreparedDatasetDescriptor = {
  datasetId: string;
  input: DeckDatasetInput;
  cacheKey: string | undefined;
};

function resolvePreparedDatasetDescriptors(options: {
  datasets: Record<string, DeckDatasetInput>;
  sqlSourceIdentity: object;
}): PreparedDatasetDescriptor[] {
  const {datasets, sqlSourceIdentity} = options;

  return Object.entries(datasets).map(([datasetId, input]) => ({
    datasetId,
    input,
    cacheKey: resolvePreparedDatasetCacheKey({
      input,
      sqlSourceIdentity,
    }),
  }));
}

/**
 * Create a feature-local cache store for prepared deck datasets.
 *
 * The store is intentionally scoped to deck's preparation layer. It reuses the
 * expensive result of `prepareDeckDataset(...)` across consumers while leaving
 * raw query/result caching to the upstream data provider:
 *
 * - Mosaic handles cached query results through its coordinator/query manager
 * - DuckDB-backed SQL datasets still use the DuckDB slice execution path
 *
 * This keeps `@sqlrooms/deck` independent from either provider while still
 * avoiding repeated geometry decoding and GeoArrow/GeoJSON shaping work.
 */
export function createPreparedDatasetStore(
  options: PreparedDatasetStoreOptions = {},
) {
  const {
    maxEntries = DEFAULT_MAX_PREPARED_DATASET_ENTRIES,
    prepareDataset = prepareDeckDataset,
  } = options;

  return createStore<PreparedDatasetStoreState>((set, get) => ({
    consumerKeys: {},
    entries: {},

    ensureEntry({cacheKey, datasetId, executeSql, input}) {
      const existing = get().entries[cacheKey];
      if (existing) {
        if (existing.status !== 'loading') {
          set((state) => ({
            ...state,
            entries: {
              ...state.entries,
              [cacheKey]: touchEntry(existing),
            },
          }));
        }
        return;
      }

      const promise = Promise.resolve().then(async () => {
        try {
          let table = resolveArrowTable(input);
          if (!table && isSqlDatasetInput(input)) {
            const queryHandle = await executeSql(input.sqlQuery);
            if (!queryHandle) {
              throw new Error(
                `Query for dataset "${datasetId}" was cancelled.`,
              );
            }

            table = await queryHandle;
          }

          if (!table) {
            return;
          }

          const prepared = prepareDataset({
            datasetId,
            table,
            geometryColumn: input.geometryColumn,
            geometryEncodingHint: input.geometryEncodingHint,
          });

          set((state) => ({
            ...state,
            entries: evictLruEntries(
              {
                ...state.entries,
                [cacheKey]: {
                  status: 'ready',
                  prepared,
                  consumers:
                    state.entries[cacheKey]?.consumers ?? new Set<string>(),
                  lastAccessedAt: nextAccessTimestamp(),
                },
              },
              maxEntries,
            ),
          }));
        } catch (error) {
          set((state) => ({
            ...state,
            entries: evictLruEntries(
              {
                ...state.entries,
                [cacheKey]: {
                  status: 'error',
                  error:
                    error instanceof Error ? error : new Error(String(error)),
                  consumers:
                    state.entries[cacheKey]?.consumers ?? new Set<string>(),
                  lastAccessedAt: nextAccessTimestamp(),
                },
              },
              maxEntries,
            ),
          }));
        }
      });

      set((state) => ({
        ...state,
        entries: {
          ...state.entries,
          [cacheKey]: {
            status: 'loading',
            promise,
            consumers: state.entries[cacheKey]?.consumers ?? new Set<string>(),
            lastAccessedAt: nextAccessTimestamp(),
          },
        },
      }));
    },

    syncConsumer(consumerId, keys) {
      const previousKeys = new Set(get().consumerKeys[consumerId] ?? []);
      const nextKeys = new Set(keys);

      set((state) => {
        let didChangeEntries = false;
        let nextEntries = state.entries;

        const updateEntry = (
          cacheKey: string,
          updater: (
            entry: PreparedDatasetCacheEntry,
          ) => PreparedDatasetCacheEntry,
        ) => {
          const currentEntry = nextEntries[cacheKey];
          if (!currentEntry) {
            return;
          }

          if (!didChangeEntries) {
            nextEntries = {...nextEntries};
            didChangeEntries = true;
          }

          nextEntries[cacheKey] = updater(currentEntry);
        };

        for (const cacheKey of previousKeys) {
          if (nextKeys.has(cacheKey)) {
            continue;
          }

          updateEntry(cacheKey, (entry) => {
            const consumers = new Set(entry.consumers);
            consumers.delete(consumerId);
            return cloneEntryWithConsumers(entry, consumers);
          });
        }

        for (const cacheKey of nextKeys) {
          updateEntry(cacheKey, (entry) => {
            const consumers = new Set(entry.consumers);
            consumers.add(consumerId);
            return cloneEntryWithConsumers(entry, consumers);
          });
        }

        return {
          ...state,
          consumerKeys: {
            ...state.consumerKeys,
            [consumerId]: [...nextKeys],
          },
          entries: didChangeEntries
            ? evictLruEntries(nextEntries, maxEntries)
            : state.entries,
        };
      });
    },

    removeConsumer(consumerId) {
      const previousKeys = get().consumerKeys[consumerId];
      if (!previousKeys) {
        return;
      }

      set((state) => {
        let didChangeEntries = false;
        let nextEntries = state.entries;

        for (const cacheKey of previousKeys) {
          const entry = nextEntries[cacheKey];
          if (!entry) {
            continue;
          }

          const consumers = new Set(entry.consumers);
          consumers.delete(consumerId);

          if (!didChangeEntries) {
            nextEntries = {...nextEntries};
            didChangeEntries = true;
          }

          nextEntries[cacheKey] = cloneEntryWithConsumers(entry, consumers);
        }

        const {[consumerId]: _removedConsumer, ...nextConsumerKeys} =
          state.consumerKeys;

        return {
          ...state,
          consumerKeys: nextConsumerKeys,
          entries: didChangeEntries
            ? evictLruEntries(nextEntries, maxEntries)
            : state.entries,
        };
      });
    },

    syncDatasetsForConsumer({
      consumerId,
      datasets,
      executeSql,
      sqlSourceIdentity,
    }) {
      const descriptors = resolvePreparedDatasetDescriptors({
        datasets,
        sqlSourceIdentity,
      });
      const cacheKeys = descriptors
        .map((descriptor) => descriptor.cacheKey)
        .filter((cacheKey): cacheKey is string => Boolean(cacheKey));

      for (const descriptor of descriptors) {
        if (!descriptor.cacheKey) {
          continue;
        }

        get().ensureEntry({
          cacheKey: descriptor.cacheKey,
          datasetId: descriptor.datasetId,
          executeSql,
          input: descriptor.input,
        });
      }

      get().syncConsumer(consumerId, cacheKeys);
    },
  }));
}

/**
 * Resolve a shared prepared-store entry back into the dataset-state shape
 * consumed by `DeckJsonMap`.
 *
 * Prepared entries are shared by cache key, while `datasetId` stays a
 * view-level label used by layer binding and user-facing errors. When a shared
 * prepared entry is reused for a different dataset id, this helper remaps the
 * prepared payload so downstream callers still see the dataset id they asked
 * for.
 */
export function resolvePreparedDeckDatasetState(options: {
  datasetId: string;
  entry?: PreparedDatasetCacheEntry;
}): PreparedDeckDatasetState {
  const {datasetId, entry} = options;

  if (!entry || entry.status === 'loading') {
    return {status: 'loading'};
  }

  if (entry.status === 'error') {
    return {status: 'error', error: entry.error};
  }

  return {
    status: 'ready',
    prepared:
      entry.prepared.datasetId === datasetId
        ? entry.prepared
        : {
            ...entry.prepared,
            datasetId,
          },
  };
}

/**
 * Resolve the full `datasetId -> state` map for a dataset registry.
 *
 * This mirrors the lookup logic used by `DeckJsonMap`: unresolved Arrow
 * datasets remain `loading`, while resolvable datasets reuse shared prepared
 * entries keyed by data identity rather than by dataset id.
 */
export function resolvePreparedDeckDatasetStates(options: {
  datasets: Record<string, DeckDatasetInput>;
  entries: Record<string, PreparedDatasetCacheEntry>;
  sqlSourceIdentity: object;
}): Record<string, PreparedDeckDatasetState> {
  const {datasets, entries, sqlSourceIdentity} = options;

  return Object.fromEntries(
    resolvePreparedDatasetDescriptors({datasets, sqlSourceIdentity}).map(
      ({datasetId, cacheKey}) => [
        datasetId,
        resolvePreparedDeckDatasetState({
          datasetId,
          entry: cacheKey ? entries[cacheKey] : undefined,
        }),
      ],
    ),
  );
}

/**
 * Module-global prepared dataset cache shared by all `DeckJsonMap` instances.
 *
 * The cache stores only deck-specific prepared payloads, not raw query
 * results, and applies a small internal LRU policy so settled entries do not
 * grow without bound.
 */
export const preparedDatasetStore = createPreparedDatasetStore();
