import {Selection} from '@uwdata/mosaic-core';
import {Query} from '@uwdata/mosaic-sql';
import {useEffect, useMemo, useRef} from 'react';
import {createId} from '@paralleldrive/cuid2';
import {useStoreWithMosaic} from './MosaicSlice';

export type UseMosaicClientOptions<T = unknown> = {
  /** Unique id for this client (auto-generated if not provided) */
  id?: string;
  /** Selection name for cross-filtering (will create if doesn't exist) */
  selectionName?: string;
  /** Or pass a Selection directly */
  selection?: Selection;
  /** Query builder - receives current filter predicate */
  query: (filter: unknown) => ReturnType<typeof Query.from>;
  /** Callback when query results are received */
  queryResult?: (result: T) => void;
  /** Whether to automatically connect when mosaic is ready */
  enabled?: boolean;
};

export function useMosaicClient<T = unknown>(
  options: UseMosaicClientOptions<T>,
) {
  const {
    id: providedId,
    selectionName,
    selection: directSelection,
    query,
    queryResult,
    enabled = true,
  } = options;

  // Use stable id - generate once if not provided
  const stableId = useMemo(() => providedId ?? createId(), [providedId]);

  const connectionStatus = useStoreWithMosaic(
    (s) => s.mosaic.connection.status,
  );
  const ensureClient = useStoreWithMosaic((s) => s.mosaic.ensureClient);
  const destroyClient = useStoreWithMosaic((s) => s.mosaic.destroyClient);

  // Select per-client state from store
  const clientState = useStoreWithMosaic((s) => s.mosaic.clients[stableId]);

  // Keep query and queryResult in refs so they can be accessed in effect
  const queryRef = useRef(query);
  const queryResultRef = useRef(queryResult);

  useEffect(() => {
    queryRef.current = query;
    queryResultRef.current = queryResult;
  }, [query, queryResult]);

  useEffect(() => {
    if (!enabled || connectionStatus !== 'ready') {
      return;
    }

    ensureClient({
      id: stableId,
      selectionName,
      selection: directSelection,
      query: queryRef.current,
      onQueryResult: queryResultRef.current,
    });

    return () => {
      destroyClient(stableId);
    };
  }, [
    enabled,
    connectionStatus,
    stableId,
    selectionName,
    directSelection,
    ensureClient,
    destroyClient,
  ]);

  return {
    data: (clientState?.data as T | null) ?? null,
    isLoading: clientState?.isLoading ?? connectionStatus !== 'ready',
    client: clientState?.client ?? null,
  };
}
