import {createId} from '@paralleldrive/cuid2';
import {useEffect, useMemo, useRef} from 'react';
import {type MosaicClientOptions, useStoreWithMosaic} from './MosaicSlice';
import {toArrowClientResult} from './tableInterop';
import {
  assertChartDataPolicy,
  createChartRuntimeIssueFromError,
  type ChartDataPolicy,
  type ChartRuntimeIssueContext,
  type ChartRuntimeIssueReporter,
} from './chart-runtime';

export type UseMosaicClientOptions = MosaicClientOptions & {
  /** Whether to automatically connect when mosaic is ready */
  enabled?: boolean;
  dataPolicy?: ChartDataPolicy | null;
  runtimeIssueContext?: ChartRuntimeIssueContext;
  runtimeIssueReporter?: ChartRuntimeIssueReporter;
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
    dataPolicy,
    runtimeIssueContext,
    runtimeIssueReporter,
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
  const dataPolicyRef = useRef(dataPolicy);
  const runtimeIssueContextRef = useRef(runtimeIssueContext);
  const runtimeIssueReporterRef = useRef(runtimeIssueReporter);

  useEffect(() => {
    queryRef.current = query;
    queryResultRef.current = queryResult;
    queryErrorRef.current = queryError;
    dataPolicyRef.current = dataPolicy;
    runtimeIssueContextRef.current = runtimeIssueContext;
    runtimeIssueReporterRef.current = runtimeIssueReporter;
  }, [
    dataPolicy,
    query,
    queryError,
    queryResult,
    runtimeIssueContext,
    runtimeIssueReporter,
  ]);

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
        try {
          assertChartDataPolicy(dataPolicyRef.current, result);
          runtimeIssueReporterRef.current?.clearIssue();
        } catch (error) {
          const normalizedError =
            error instanceof Error ? error : new Error(String(error));
          if (runtimeIssueContextRef.current) {
            runtimeIssueReporterRef.current?.reportIssue(
              createChartRuntimeIssueFromError(
                normalizedError,
                runtimeIssueContextRef.current,
                dataPolicyRef.current,
              ),
            );
          }
          queryErrorRef.current?.(normalizedError);
          return;
        }
        queryResultRef.current?.(toArrowClientResult(result));
      },
      onQueryError: (error) => {
        const normalizedError =
          error instanceof Error ? error : new Error(String(error));
        if (runtimeIssueContextRef.current) {
          runtimeIssueReporterRef.current?.reportIssue(
            createChartRuntimeIssueFromError(
              normalizedError,
              runtimeIssueContextRef.current,
              dataPolicyRef.current,
            ),
          );
        }
        queryErrorRef.current?.(normalizedError);
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
