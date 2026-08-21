import type * as arrow from 'apache-arrow';
import {
  isArrowTableDatasetInput,
  isSqlDatasetInput,
  isTableDatasetInput,
  type DeckDatasetInput,
  type PreparedDeckDatasetState,
} from '../types';
import {resolveArrowTable} from './normalizeDatasets';
import type {PreparedDatasetCacheEntry} from './types';

export const DEFAULT_MAX_PREPARED_DATASET_ENTRIES = 20;

let nextDatasetAccess = 0;
let nextTableIdentity = 0;
let nextSqlSourceIdentity = 0;

const tableIdentities = new WeakMap<arrow.Table, string>();
const sqlSourceIdentities = new WeakMap<object, string>();

/** Return a monotonic access timestamp used by the prepared-dataset LRU. */
export function nextAccessTimestamp(): number {
  nextDatasetAccess += 1;
  return nextDatasetAccess;
}

/**
 * Assign a stable cache identity to an Arrow table object.
 *
 * Table identities are stored in a `WeakMap` so this cache does not extend the
 * lifetime of tables once they are no longer referenced elsewhere.
 */
export function getTableIdentity(table: arrow.Table): string {
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
export function getSqlSourceIdentity(sqlSourceIdentity: object): string {
  const cached = sqlSourceIdentities.get(sqlSourceIdentity);
  if (cached) {
    return cached;
  }

  nextSqlSourceIdentity += 1;
  const identity = `sql-source:${nextSqlSourceIdentity}`;
  sqlSourceIdentities.set(sqlSourceIdentity, identity);
  return identity;
}

export function buildGeometryKey(options: {
  geometryColumn?: string;
  geometryEncodingHint?: string;
}): string {
  return `${options.geometryColumn ?? ''}\u0001${options.geometryEncodingHint ?? ''}`;
}

/**
 * Content identity for one dataset input, ignoring object-wrapper identity.
 *
 * Spec-only updates (slider opacity, radius, etc.) often recreate
 * `{ tableName, transformSql }` literals even though the query did not change.
 */
export function getDatasetInputFingerprint(input: DeckDatasetInput): string {
  if (isSqlDatasetInput(input)) {
    return `sql\u0001${input.sqlQuery}\u0001${buildGeometryKey(input)}`;
  }
  if (isTableDatasetInput(input)) {
    return `table\u0001${input.tableName}\u0001${input.transformSql ?? ''}\u0001${buildGeometryKey(input)}`;
  }
  if (isArrowTableDatasetInput(input)) {
    const table = resolveArrowTable(input);
    return `arrow\u0001${table ? getTableIdentity(table) : 'pending'}\u0001${buildGeometryKey(input)}`;
  }
  return 'unknown';
}

/** Sorted content identity for a dataset registry. */
export function getDatasetRegistryFingerprint(
  datasets: Record<string, DeckDatasetInput>,
): string {
  return Object.entries(datasets)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(
      ([datasetId, input]) =>
        `${datasetId}\u0001${getDatasetInputFingerprint(input)}`,
    )
    .join('\u0002');
}

/**
 * Identity of prepared dataset *payloads*, not the wrapper object.
 *
 * Used so JSONConverter is not rebuilt when a new `datasetStates` record
 * points at the same prepared tables. Geometry column and encoding are part
 * of the identity so two cache entries that share an Arrow table but were
 * prepared with different geometry options do not look interchangeable.
 */
export function getPreparedDatasetStatesIdentity(
  datasetStates: Record<string, PreparedDeckDatasetState>,
): string {
  return Object.keys(datasetStates)
    .sort()
    .map((datasetId) => {
      const state = datasetStates[datasetId]!;
      if (state.status === 'ready') {
        return [
          datasetId,
          'ready',
          getTableIdentity(state.prepared.table),
          buildGeometryKey({
            geometryColumn: state.prepared.datasetGeometryColumn,
            geometryEncodingHint: state.prepared.datasetGeometryEncodingHint,
          }),
        ].join(':');
      }
      if (state.status === 'error') {
        return `${datasetId}:error:${state.error.message}`;
      }
      return `${datasetId}:${state.status}`;
    })
    .join('|');
}

/**
 * Build the canonical cache key for one dataset input.
 *
 * The key intentionally ignores the user-facing dataset id and instead uses
 * the underlying data identity:
 *
 * - SQL/table datasets: DuckDB connector identity + compiled SQL + geometry options
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

  if (isSqlDatasetInput(input) || isTableDatasetInput(input)) {
    if (!sqlSourceIdentity) {
      throw new Error(
        'SQL-backed dataset cache keys require a sqlSourceIdentity object.',
      );
    }

    if (isTableDatasetInput(input)) {
      return [
        'table',
        getSqlSourceIdentity(sqlSourceIdentity),
        input.tableName,
        input.transformSql ?? '',
        buildGeometryKey(input),
      ].join('\u0001');
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
export function cloneEntryWithConsumers(
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
export function touchEntry(
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
export function evictLruEntries(
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
