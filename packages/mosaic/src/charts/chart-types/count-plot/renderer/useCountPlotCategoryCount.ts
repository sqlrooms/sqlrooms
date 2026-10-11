import type {Coordinator} from '@uwdata/mosaic-core';
import type {QualifiedTableName} from '@sqlrooms/duckdb';
import {useEffect, useState} from 'react';
import {
  CountPlotCategoryCountClient,
  type CountPlotCategoryCountState,
} from './CountPlotCategoryCountClient';

type CountPlotCategoryCountHookState = CountPlotCategoryCountState & {
  field?: string;
};

/**
 * Connects the count-plot category-count client for runtime chart sizing.
 */
export function useCountPlotCategoryCount(args: {
  coordinator: Coordinator;
  field: string | undefined;
  table: QualifiedTableName;
}): CountPlotCategoryCountState {
  const {coordinator, field, table} = args;
  const [state, setState] = useState<CountPlotCategoryCountHookState>({
    isLoading: false,
  });

  useEffect(() => {
    if (!field) {
      return;
    }

    const client = new CountPlotCategoryCountClient({
      field,
      onStateChange: (nextState) => setState({...nextState, field}),
      table,
    });
    coordinator.connect(client);

    return () => {
      client.destroy();
    };
  }, [coordinator, field, table]);

  if (!field) {
    return {isLoading: false};
  }

  if (state.field !== field) {
    return {isLoading: true};
  }

  return state;
}
