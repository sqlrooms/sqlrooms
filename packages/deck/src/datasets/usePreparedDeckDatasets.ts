import {useEffect, useMemo, useState} from 'react';
import {useStoreWithDuckDb} from '@sqlrooms/duckdb';
import {useStore} from 'zustand';
import {type DeckDatasetInput, type PreparedDeckDatasetState} from '../types';
import {resolvePreparedDatasetCacheKey} from './helpers';
import {
  preparedDatasetStore,
  resolvePreparedDeckDatasetState,
} from './PreparedDatasetStore';

let nextPreparedDatasetConsumerId = 0;

/**
 * Subscribe a `DeckJsonMap` instance to prepared dataset state.
 *
 * This hook is intentionally a thin React adapter over the internal prepared
 * dataset store. The heavy work lives in the store so prepared geometry can be
 * reused across rerenders and even across multiple map instances, while the
 * hook itself focuses on:
 *
 * - computing stable cache keys for the current dataset registry
 * - ensuring the corresponding prepared entries exist
 * - mapping shared cache entries back to `datasetId -> state`
 *
 * It preserves the current loading behavior for unresolved Arrow inputs, so a
 * caller can pass `{arrowTable: undefined}` and still render the basemap while
 * data is loading.
 */
export function usePreparedDeckDatasets(
  datasets: Record<string, DeckDatasetInput>,
): Record<string, PreparedDeckDatasetState> {
  const executeSql = useStoreWithDuckDb((state) => state.db.executeSql);
  const connector = useStoreWithDuckDb((state) => state.db.connector);
  const [consumerId] = useState(() => {
    nextPreparedDatasetConsumerId += 1;
    return `prepared-dataset-consumer:${nextPreparedDatasetConsumerId}`;
  });
  const entries = useStore(preparedDatasetStore, (state) => state.entries);
  const datasetDescriptors = useMemo(
    () =>
      Object.entries(datasets).map(([datasetId, input]) => ({
        datasetId,
        input,
        cacheKey: resolvePreparedDatasetCacheKey({
          input,
          sqlSourceIdentity: connector,
        }),
      })),
    [datasets, connector],
  );

  useEffect(() => {
    const cacheKeys = datasetDescriptors
      .map((descriptor) => descriptor.cacheKey)
      .filter((cacheKey): cacheKey is string => Boolean(cacheKey));

    preparedDatasetStore.getState().syncConsumer(consumerId, cacheKeys);

    for (const descriptor of datasetDescriptors) {
      if (!descriptor.cacheKey) {
        continue;
      }

      preparedDatasetStore.getState().ensureEntry({
        cacheKey: descriptor.cacheKey,
        datasetId: descriptor.datasetId,
        executeSql,
        input: descriptor.input,
      });
    }

    return () => {
      preparedDatasetStore.getState().removeConsumer(consumerId);
    };
  }, [consumerId, datasetDescriptors, executeSql]);

  return useMemo(
    () =>
      Object.fromEntries(
        datasetDescriptors.map(({datasetId, cacheKey}) => [
          datasetId,
          resolvePreparedDeckDatasetState({
            datasetId,
            entry: cacheKey ? entries[cacheKey] : undefined,
          }),
        ]),
      ),
    [datasetDescriptors, entries],
  );
}
