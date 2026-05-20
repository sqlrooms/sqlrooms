import {createId} from '@paralleldrive/cuid2';
import {useEffect, useMemo, useRef} from 'react';
import {type MosaicClientOptions, useStoreWithMosaic} from './MosaicSlice';
import {toArrowClientResult} from './tableInterop';

export type UseMosaicClientOptions = MosaicClientOptions & {
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
    queryError,
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
  const queryErrorRef = useRef(queryError);

  useEffect(() => {
    queryRef.current = query;
    queryResultRef.current = queryResult;
    queryErrorRef.current = queryError;
  }, [query, queryError, queryResult]);

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
      onQueryError: (error) => {
        queryErrorRef.current?.(error);
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
    error: clientState?.error,
    client: clientState?.client ?? null,
  };
}
