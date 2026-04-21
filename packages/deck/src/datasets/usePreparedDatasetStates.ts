import {useStoreWithDuckDb} from '@sqlrooms/duckdb';
import {useEffect, useMemo, useState} from 'react';
import {useStore} from 'zustand';
import {type DeckDatasetInput, type PreparedDeckDatasetState} from '../types';
import {
  preparedDatasetStore,
  resolvePreparedDeckDatasetStates,
} from './preparedDatasetStore';

let nextPreparedDatasetConsumerId = 0;

/**
 * Subscribe a `DeckJsonMap` instance to prepared dataset state.
 *
 * This hook is intentionally a thin React adapter over the internal prepared
 * dataset store. The heavy work lives in the store so prepared geometry can be
 * reused across rerenders and even across multiple map instances, while the
 * hook itself focuses on subscribing React to the store and cleaning up the
 * consumer membership for this map instance.
 *
 * It preserves the current loading behavior for unresolved Arrow inputs, so a
 * caller can pass `{arrowTable: undefined}` and still render the basemap while
 * data is loading.
 */
export function usePreparedDatasetStates(
  datasets: Record<string, DeckDatasetInput>,
): Record<string, PreparedDeckDatasetState> {
  const executeSql = useStoreWithDuckDb((state) => state.db.executeSql);
  const connector = useStoreWithDuckDb((state) => state.db.connector);
  const [consumerId] = useState(() => {
    nextPreparedDatasetConsumerId += 1;
    return `prepared-dataset-consumer:${nextPreparedDatasetConsumerId}`;
  });
  const entries = useStore(preparedDatasetStore, (state) => state.entries);

  useEffect(() => {
    preparedDatasetStore.getState().syncDatasetsForConsumer({
      consumerId,
      datasets,
      executeSql,
      sqlSourceIdentity: connector,
    });

    return () => {
      preparedDatasetStore.getState().removeConsumer(consumerId);
    };
  }, [connector, consumerId, datasets, executeSql]);

  return useMemo(
    () =>
      resolvePreparedDeckDatasetStates({
        datasets,
        entries,
        sqlSourceIdentity: connector,
      }),
    [connector, datasets, entries],
  );
}
