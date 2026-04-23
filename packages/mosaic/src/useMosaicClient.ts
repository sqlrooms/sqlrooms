import {Selection} from '@uwdata/mosaic-core';
import {Query} from '@uwdata/mosaic-sql';
import type {Table as ArrowTable} from 'apache-arrow';
import {useEffect, useMemo, useRef} from 'react';
import {createId} from '@paralleldrive/cuid2';
import {useStoreWithMosaic} from './MosaicSlice';
import {toArrowClientResult} from './tableInterop';

export type UseMosaicClientOptions = {
  /** Unique id for this client (auto-generated if not provided) */
  id?: string;
  /** Selection name for cross-filtering (will create if doesn't exist) */
  selectionName?: string;
  /** Or pass a Selection directly */
  selection?: Selection;
  /** Query builder - receives current filter predicate */
  query: (filter: unknown) => ReturnType<typeof Query.from>;
  /** Callback when query results are received */
  queryResult?: (result: ArrowTable) => void;
  /** Whether to automatically connect when mosaic is ready */
  enabled?: boolean;
};

export function useMosaicClient(options: UseMosaicClientOptions) {
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

  // Select the raw Mosaic client state; public hook data is normalized below.
  const clientState = useStoreWithMosaic((s) => s.mosaic.clients[stableId]);

  // Keep query and queryResult in refs so they can be accessed in effect
  const queryRef = useRef(query);
  const queryResultRef = useRef(queryResult);

  useEffect(() => {
    queryRef.current = query;
    queryResultRef.current = queryResult;
  }, [query, queryResult]);

  const clientData = clientState?.data;
  const arrowData = useMemo(() => {
    if (!clientData) {
      return null;
    }
    return toArrowClientResult(clientData);
  }, [clientData]);

  useEffect(() => {
    if (!enabled || connectionStatus !== 'ready') {
      return;
    }

    ensureClient({
      id: stableId,
      selectionName,
      selection: directSelection,
      query: queryRef.current,
      onQueryResult: (result) => {
        queryResultRef.current?.(toArrowClientResult(result));
      },
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
    data: arrowData,
    isLoading: clientState?.isLoading ?? connectionStatus !== 'ready',
    client: clientState?.client ?? null,
  };
}
