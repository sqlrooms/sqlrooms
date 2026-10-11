import type * as arrow from 'apache-arrow';
import type {GeometryEncodingHint, PreparedDeckDataset} from '../prepare/types';

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
export type PreparedDatasetCacheEntry = {
  /** Consumer ids currently subscribed to this cache entry. */
  consumers: Set<string>;
  /** Monotonic access counter used to evict the least-recently-used entry. */
  lastAccessedAt: number;
} & (
  | {status: 'loading'; promise: Promise<void>}
  | {status: 'ready'; prepared: PreparedDeckDataset}
  | {status: 'error'; error: Error}
);

export type PreparedDatasetStoreOptions = {
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
