import {Selection} from '@uwdata/mosaic-core';
import {Query} from '@uwdata/mosaic-sql';
import {useEffect, useMemo, useRef, useState} from 'react';
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

  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const clientIdRef = useRef<string | null>(null);
  const queryResultRef = useRef(queryResult);
  const queryRef = useRef(query);

  // Keep refs up to date
  useEffect(() => {
    queryResultRef.current = queryResult;
    queryRef.current = query;
  }, [queryResult, query]);

  const connectionStatus = useStoreWithMosaic(
    (s) => s.mosaic.connection.status,
  );
  const clients = useStoreWithMosaic((s) => s.mosaic.clients);
  const createClient = useStoreWithMosaic((s) => s.mosaic.createClient);
  const destroyClient = useStoreWithMosaic((s) => s.mosaic.destroyClient);
  const getSelection = useStoreWithMosaic((s) => s.mosaic.getSelection);

  // Track the selection used to create the current client
  const selectionUsedRef = useRef<Selection | undefined>(undefined);

  useEffect(() => {
    if (!enabled || connectionStatus !== 'ready') {
      setIsLoading(connectionStatus === 'loading');
      // Clean up existing client if connection becomes unavailable
      if (clientIdRef.current) {
        destroyClient(clientIdRef.current);
        clientIdRef.current = null;
        selectionUsedRef.current = undefined;
      }
      return;
    }

    // Determine which selection to use
    const selection =
      directSelection ??
      (selectionName ? getSelection(selectionName) : undefined);

    // Check if selection has changed - if so, we need to recreate the client
    const selectionChanged = selectionUsedRef.current !== selection;

    // If we have an existing client and selection hasn't changed, don't recreate
    if (clientIdRef.current && !selectionChanged) {
      return;
    }

    // Destroy existing client if selection changed
    if (clientIdRef.current && selectionChanged) {
      destroyClient(clientIdRef.current);
      clientIdRef.current = null;
    }

    // Create wrapped queryResult that updates both data state and optional callback
    const wrappedQueryResult = (result: unknown) => {
      const typedResult = result as T;
      setData(typedResult);
      setIsLoading(false);
      queryResultRef.current?.(typedResult);
    };

    let clientId: string;
    try {
      clientId = createClient({
        id: providedId,
        selection,
        query: queryRef.current,
        queryResult: wrappedQueryResult,
      });

      clientIdRef.current = clientId;
      selectionUsedRef.current = selection;
    } catch (error) {
      console.error('Failed to create mosaic client:', error);
      setIsLoading(false);
      return;
    }

    return () => {
      if (clientIdRef.current === clientId) {
        destroyClient(clientId);
        clientIdRef.current = null;
        selectionUsedRef.current = undefined;
      }
    };
    // Store functions are stable, so we can safely omit them from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, connectionStatus, providedId, selectionName, directSelection]);

  // Get the client reference from the store
  const clientId = clientIdRef.current;
  const client = useMemo(() => {
    if (!clientId) return null;
    const tracked = clients[clientId];
    return tracked?.client ?? null;
  }, [clients, clientId]);

  return {
    data,
    isLoading: isLoading || connectionStatus !== 'ready',
    client,
  };
}
