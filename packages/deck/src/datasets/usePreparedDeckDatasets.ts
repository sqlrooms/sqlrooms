import {useEffect, useState} from 'react';
import {useStoreWithDuckDb} from '@sqlrooms/duckdb';
import {
  isSqlDatasetInput,
  type DeckDatasetInput,
  type PreparedDeckDatasetState,
} from '../types';
import {resolveArrowTable} from './normalizeDatasets';
import {prepareDeckDataset} from '../prepare/prepareDeckDataset';

export function usePreparedDeckDatasets(
  datasets: Record<string, DeckDatasetInput>,
): Record<string, PreparedDeckDatasetState> {
  const executeSql = useStoreWithDuckDb((state) => state.db.executeSql);
  const [states, setStates] = useState<
    Record<string, PreparedDeckDatasetState>
  >({});

  useEffect(() => {
    let cancelled = false;

    setStates(
      Object.fromEntries(
        Object.keys(datasets).map((datasetId) => [
          datasetId,
          {status: 'loading'},
        ]),
      ),
    );

    for (const [datasetId, input] of Object.entries(datasets)) {
      const run = async () => {
        try {
          let table = resolveArrowTable(input);
          if (!table && isSqlDatasetInput(input)) {
            const queryHandle = await executeSql(input.sqlQuery);
            if (!queryHandle) {
              throw new Error(
                `Query for dataset "${datasetId}" was cancelled.`,
              );
            }
            table = await queryHandle;
          }

          if (!table) {
            return;
          }

          const prepared = prepareDeckDataset({
            datasetId,
            table,
            geometryColumn: input.geometryColumn,
            geometryEncodingHint: input.geometryEncodingHint,
          });

          if (!cancelled) {
            setStates((current) => ({
              ...current,
              [datasetId]: {status: 'ready', prepared},
            }));
          }
        } catch (error) {
          if (!cancelled) {
            setStates((current) => ({
              ...current,
              [datasetId]: {
                status: 'error',
                error:
                  error instanceof Error ? error : new Error(String(error)),
              },
            }));
          }
        }
      };

      void run();
    }

    return () => {
      cancelled = true;
    };
  }, [datasets, executeSql]);

  return states;
}
