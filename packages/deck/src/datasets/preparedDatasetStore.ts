import type * as arrow from 'apache-arrow';
import type {QueryHandle} from '@sqlrooms/duckdb';
import {createStore} from 'zustand/vanilla';
import {
  isSqlDatasetInput,
  type DeckDatasetInput,
  type PreparedDeckDatasetState,
} from '../types';
import {prepareDeckDataset} from '../prepare/prepareDeckDataset';
import type {GeometryEncodingHint, PreparedDeckDataset} from '../prepare/types';
import {resolveArrowTable} from './normalizeDatasets';

const DEFAULT_MAX_PREPARED_DATASET_ENTRIES = 20;

let nextDatasetAccess = 0;
let nextTableIdentity = 0;
let nextSqlSourceIdentity = 0;

const tableIdentities = new WeakMap<arrow.Table, string>();
const sqlSourceIdentities = new WeakMap<object, string>();

/**
 * One cached prepared-dataset entry keyed by resolved dataset identity.
 *
 * The entry tracks both lifecycle state and eviction metadata:
 *
 * - `consumers` records which hook instances currently reference the entry, so
 *   live entries are not evicted while a map is still using them
 * - `lastAccessedAt` drives the internal LRU policy for settled entries
 * - the discriminated union stores either the in-flight preparation promise,
 *   the prepared dataset, or the terminal error
 */
type PreparedDatasetCacheEntry = {
  /** Consumer ids currently subscribed to this cache entry. */
  consumers: Set<string>;
  /** Monotonic access counter used to evict the least-recently-used entry. */
  lastAccessedAt: number;
} & (
  | {status: 'loading'; promise: Promise<void>}
  | {status: 'ready'; prepared: PreparedDeckDataset}
  | {status: 'error'; error: Error}
);

/**
 * Internal store state for the prepared-dataset cache.
 *
 * `DeckJsonMap` never talks to this shape directly; `usePreparedDeckDatasets`
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
};

type PreparedDatasetStoreOptions = {
  /** Maximum number of settled prepared entries to retain before LRU eviction. */
  maxEntries?: number;
  /** Injectable preparation function for tests and future specialization. */
  prepareDataset?: (options: {
    datasetId: string;
    geometryColumn?: string;
    geometryEncodingHint?: GeometryEncodingHint;
    table: arrow.Table;
  }) => PreparedDeckDataset;
};

function nextAccessTimestamp(): number {
  nextDatasetAccess += 1;
  return nextDatasetAccess;
}

/**
 * Assign a stable cache identity to an Arrow table object.
 *
 * Table identities are stored in a `WeakMap` so this cache does not extend the
 * lifetime of tables once they are no longer referenced elsewhere.
 */
function getTableIdentity(table: arrow.Table): string {
  const cached = tableIdentities.get(table);
  if (cached) {
    return cached;
  }

  nextTableIdentity += 1;
  const identity = `table:${nextTableIdentity}`;
  tableIdentities.set(table, identity);
  return identity;
}

/**
 * Assign a stable cache identity to the current SQL source object.
 *
 * For SQL datasets we include the upstream DuckDB connector identity in the
 * cache key so two rooms using the same SQL text do not accidentally share
 * prepared results across different database instances.
 */
function getSqlSourceIdentity(sqlSourceIdentity: object): string {
  const cached = sqlSourceIdentities.get(sqlSourceIdentity);
  if (cached) {
    return cached;
  }

  nextSqlSourceIdentity += 1;
  const identity = `sql-source:${nextSqlSourceIdentity}`;
  sqlSourceIdentities.set(sqlSourceIdentity, identity);
  return identity;
}

function buildGeometryKey(input: DeckDatasetInput): string {
  return `${input.geometryColumn ?? ''}\u0001${input.geometryEncodingHint ?? ''}`;
}

/**
 * Build the canonical cache key for one dataset input.
 *
 * The key intentionally ignores the user-facing dataset id and instead uses
 * the underlying data identity:
 *
 * - SQL datasets: DuckDB connector identity + SQL text + geometry options
 * - Arrow datasets: table object identity + geometry options
 *
 * Unresolved Arrow inputs (`arrowTable: undefined`) return `undefined`, which
 * signals that the dataset should remain in `loading` until a table exists.
 */
export function resolvePreparedDatasetCacheKey(options: {
  input: DeckDatasetInput;
  sqlSourceIdentity?: object;
}): string | undefined {
  const {input, sqlSourceIdentity} = options;

  if (isSqlDatasetInput(input)) {
    if (!sqlSourceIdentity) {
      throw new Error(
        'SQL dataset cache keys require a sqlSourceIdentity object.',
      );
    }

    return [
      'sql',
      getSqlSourceIdentity(sqlSourceIdentity),
      input.sqlQuery,
      buildGeometryKey(input),
    ].join('\u0001');
  }

  const table = resolveArrowTable(input);
  if (!table) {
    return undefined;
  }

  return ['arrow', getTableIdentity(table), buildGeometryKey(input)].join(
    '\u0001',
  );
}

/**
 * Clone a cache entry while replacing its consumer set and refreshing the
 * access timestamp.
 *
 * This keeps the discriminated union shape intact while centralizing the
 * bookkeeping needed by consumer reconciliation and LRU tracking.
 */
function cloneEntryWithConsumers(
  entry: PreparedDatasetCacheEntry,
  consumers: Set<string>,
): PreparedDatasetCacheEntry {
  const lastAccessedAt = nextAccessTimestamp();

  if (entry.status === 'loading') {
    return {
      status: 'loading',
      promise: entry.promise,
      consumers,
      lastAccessedAt,
    };
  }

  if (entry.status === 'ready') {
    return {
      status: 'ready',
      prepared: entry.prepared,
      consumers,
      lastAccessedAt,
    };
  }

  return {
    status: 'error',
    error: entry.error,
    consumers,
    lastAccessedAt,
  };
}

/** Mark an entry as recently used without changing its lifecycle payload. */
function touchEntry(
  entry: PreparedDatasetCacheEntry,
): PreparedDatasetCacheEntry {
  return cloneEntryWithConsumers(entry, new Set(entry.consumers));
}

/**
 * Evict least-recently-used settled entries when the cache exceeds capacity.
 *
 * Only `ready` and `error` entries participate in eviction. `loading` entries
 * are preserved so in-flight work is not discarded, and referenced entries are
 * preserved so active maps never lose their prepared data mid-render.
 */
function evictLruEntries(
  entries: Record<string, PreparedDatasetCacheEntry>,
  maxEntries: number,
): Record<string, PreparedDatasetCacheEntry> {
  const settledEntries = Object.entries(entries).filter(
    ([, entry]) => entry.status !== 'loading',
  );

  if (settledEntries.length <= maxEntries) {
    return entries;
  }

  const evictable = settledEntries
    .filter(([, entry]) => entry.consumers.size === 0)
    .sort(([, left], [, right]) => left.lastAccessedAt - right.lastAccessedAt);

  if (evictable.length === 0) {
    return entries;
  }

  const nextEntries = {...entries};
  let settledCount = settledEntries.length;

  for (const [cacheKey] of evictable) {
    if (settledCount <= maxEntries) {
      break;
    }

    delete nextEntries[cacheKey];
    settledCount -= 1;
  }

  return nextEntries;
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
 * Module-global prepared dataset cache shared by all `DeckJsonMap` instances.
 *
 * The cache stores only deck-specific prepared payloads, not raw query
 * results, and applies a small internal LRU policy so settled entries do not
 * grow without bound.
 */
export const preparedDatasetStore = createPreparedDatasetStore();
