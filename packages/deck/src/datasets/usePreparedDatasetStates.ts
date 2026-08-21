import {useStoreWithDuckDb} from '@sqlrooms/duckdb';
import {useEffect, useId, useMemo, useState} from 'react';
import {useStore} from 'zustand';
import {type DeckDatasetInput, type PreparedDeckDatasetState} from '../types';
import {
  getDatasetRegistryFingerprint,
  getPreparedDatasetStatesIdentity,
} from './helpers';
import {
  preparedDatasetStore,
  resolvePreparedDeckDatasetStates,
} from './PreparedDatasetStore';

/**
 * Stabilize a `datasets` record so that a new object wrapper created on every
 * render (for example after a slider-driven spec update) does not resync
 * prepared data when the underlying query/table identity is unchanged.
 *
 * Implemented via the "adjusting state during rendering" pattern so the
 * React compiler does not flag ref access during render.
 */
function useStableDatasets(
  datasets: Record<string, DeckDatasetInput>,
): Record<string, DeckDatasetInput> {
  const [stable, setStable] = useState(datasets);
  if (
    getDatasetRegistryFingerprint(stable) !==
    getDatasetRegistryFingerprint(datasets)
  ) {
    setStable(datasets);
  }
  return stable;
}

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
  const stableDatasets = useStableDatasets(datasets);
  const executeSql = useStoreWithDuckDb((state) => state.db.executeSql);
  const connector = useStoreWithDuckDb((state) => state.db.connector);
  const consumerId = useId();
  const entries = useStore(preparedDatasetStore, (state) => state.entries);

  useEffect(() => {
    preparedDatasetStore.getState().syncDatasetsForConsumer({
      consumerId,
      datasets: stableDatasets,
      executeSql,
      sqlSourceIdentity: connector,
    });

    return () => {
      preparedDatasetStore.getState().removeConsumer(consumerId);
    };
  }, [connector, consumerId, stableDatasets, executeSql]);

  const datasetStates = useMemo(
    () =>
      resolvePreparedDeckDatasetStates({
        datasets: stableDatasets,
        entries,
        sqlSourceIdentity: connector,
      }),
    [connector, stableDatasets, entries],
  );

  const [stableStates, setStableStates] = useState(datasetStates);
  if (
    getPreparedDatasetStatesIdentity(stableStates) !==
    getPreparedDatasetStatesIdentity(datasetStates)
  ) {
    setStableStates(datasetStates);
  }
  return stableStates;
}
