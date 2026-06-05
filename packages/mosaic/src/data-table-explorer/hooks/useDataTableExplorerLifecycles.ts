import {useEffect, useRef} from 'react';
import type {MosaicClient, Selection} from '@uwdata/mosaic-core';
import type {MosaicSliceState} from '../../MosaicSlice';
import type {DataTableExplorerStore} from '../createDataTableExplorerStore';
import type {
  DataTableExplorerPaginationState,
  DataTableExplorerSorting,
} from '../types';
import type {DataTableExplorerStoreState} from '../createDataTableExplorerStore';
import {
  connectDataTableExplorerCountClient,
  connectDataTableExplorerPageClient,
  connectDataTableExplorerSummaryClients,
  loadDataTableExplorerSchema,
} from '../dataTableExplorerController';

export type UseDataTableExplorerLifecyclesOptions = {
  categoryLimit: number;
  columns?: string[];
  connection: MosaicSliceState['mosaic']['connection'];
  fieldNames: string[];
  fields: DataTableExplorerStoreState['schema']['fields'];
  pageSize: number;
  pagination: DataTableExplorerPaginationState;
  dataTableExplorerStore: DataTableExplorerStore;
  rowFilter: ReturnType<Selection['predicate']>;
  selection: Selection;
  selectionVersion: number;
  sorting: DataTableExplorerSorting;
  summaryBins: number;
  tableName: string;
};

export type UseDataTableExplorerLifecyclesReturn = {
  client: MosaicClient | null;
};

/**
 * Owns the coordinator-backed schema, row, count, and summary client
 * lifecycles for a dataTableExplorer instance.
 */
export function useDataTableExplorerLifecycles(
  options: UseDataTableExplorerLifecyclesOptions,
): UseDataTableExplorerLifecyclesReturn {
  const {
    categoryLimit,
    columns,
    connection,
    fieldNames,
    fields,
    pageSize,
    pagination,
    dataTableExplorerStore,
    rowFilter,
    selection,
    selectionVersion,
    sorting,
    summaryBins,
    tableName,
  } = options;
  const previousTableNameRef = useRef(tableName);

  useEffect(() => {
    dataTableExplorerStore.getState().syncPageSize(pageSize);
  }, [pageSize, dataTableExplorerStore]);

  useEffect(() => {
    if (previousTableNameRef.current === tableName) return;
    selection.reset();
    previousTableNameRef.current = tableName;
  }, [selection, tableName]);

  useEffect(() => {
    dataTableExplorerStore.getState().resetPageIndex();
  }, [dataTableExplorerStore, selectionVersion, tableName]);

  useEffect(() => {
    if (connection.status !== 'ready' || !tableName) {
      dataTableExplorerStore.getState().setSchemaSuccess([]);
      dataTableExplorerStore.getState().setSchemaError(undefined);
      dataTableExplorerStore
        .getState()
        .setSchemaLoading(connection.status === 'loading');
      return;
    }

    void loadDataTableExplorerSchema({
      columns,
      coordinator: connection.coordinator,
      store: dataTableExplorerStore,
      tableName,
    });
  }, [columns, connection, dataTableExplorerStore, tableName]);

  useEffect(() => {
    if (connection.status !== 'ready' || !tableName || !fieldNames.length) {
      dataTableExplorerStore.getState().setPage({isLoading: false});
      return;
    }

    return connectDataTableExplorerPageClient({
      connection,
      fieldNames,
      filter: rowFilter,
      pagination,
      sorting,
      store: dataTableExplorerStore,
      tableName,
    });
  }, [
    connection,
    fieldNames,
    pagination,
    dataTableExplorerStore,
    rowFilter,
    sorting,
    tableName,
  ]);

  useEffect(() => {
    if (connection.status !== 'ready' || !tableName) {
      dataTableExplorerStore.getState().setFilteredCount({isLoading: false});
      dataTableExplorerStore.getState().setClient(null);
      return;
    }

    const {client: newClient, cleanup} = connectDataTableExplorerCountClient({
      connection,
      filterStable: true,
      selection,
      store: dataTableExplorerStore,
      tableName,
      target: 'filtered',
    });
    dataTableExplorerStore.getState().setClient(newClient);

    return () => {
      cleanup();
      dataTableExplorerStore.getState().setClient(null);
    };
  }, [connection, dataTableExplorerStore, selection, tableName]);

  useEffect(() => {
    if (connection.status !== 'ready' || !tableName) {
      dataTableExplorerStore.getState().setTotalCount({isLoading: false});
      return;
    }

    const {cleanup} = connectDataTableExplorerCountClient({
      connection,
      store: dataTableExplorerStore,
      tableName,
      target: 'total',
    });

    return cleanup;
  }, [connection, dataTableExplorerStore, tableName]);

  useEffect(() => {
    if (connection.status !== 'ready' || !fields.length) {
      dataTableExplorerStore.getState().clearSummaries();
      return;
    }

    return connectDataTableExplorerSummaryClients({
      categoryLimit,
      connection,
      fields,
      selection,
      store: dataTableExplorerStore,
      summaryBins,
      tableName,
    });
  }, [
    categoryLimit,
    connection,
    fields,
    dataTableExplorerStore,
    selection,
    summaryBins,
    tableName,
  ]);

  // Client is not returned - it's stored in the dataTableExplorerStore
  return {client: null};
}
