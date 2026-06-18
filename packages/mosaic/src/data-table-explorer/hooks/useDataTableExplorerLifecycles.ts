import {useEffect, useRef} from 'react';
import type {MosaicClient, Selection} from '@uwdata/mosaic-core';
import type {MosaicSliceState} from '../../MosaicSlice';
import type {DataTableExplorerStore} from '../createDataTableExplorerStore';
import type {
  DataTableExplorerPaginationState,
  DataTableExplorerSqlTableReference,
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
  tableIdentity: string;
  tableName: string;
  tableReference: DataTableExplorerSqlTableReference;
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
    tableIdentity,
    tableName,
    tableReference,
  } = options;
  const previousTableNameRef = useRef(tableIdentity);

  useEffect(() => {
    dataTableExplorerStore.getState().syncPageSize(pageSize);
  }, [pageSize, dataTableExplorerStore]);

  useEffect(() => {
    if (previousTableNameRef.current === tableIdentity) return;
    selection.reset();
    previousTableNameRef.current = tableIdentity;
  }, [selection, tableIdentity]);

  useEffect(() => {
    dataTableExplorerStore.getState().resetPageIndex();
  }, [dataTableExplorerStore, selectionVersion, tableIdentity]);

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
      tableIdentity,
      tableName,
    });
  }, [columns, connection, dataTableExplorerStore, tableIdentity, tableName]);

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
      tableName: tableIdentity,
      tableReference,
    });
  }, [
    connection,
    fieldNames,
    pagination,
    dataTableExplorerStore,
    rowFilter,
    sorting,
    tableIdentity,
    tableName,
    tableReference,
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
      tableName: tableIdentity,
      tableReference,
      target: 'filtered',
    });
    dataTableExplorerStore.getState().setClient(newClient);

    return () => {
      cleanup();
      dataTableExplorerStore.getState().setClient(null);
    };
  }, [
    connection,
    dataTableExplorerStore,
    selection,
    tableIdentity,
    tableName,
    tableReference,
  ]);

  useEffect(() => {
    if (connection.status !== 'ready' || !tableName) {
      dataTableExplorerStore.getState().setTotalCount({isLoading: false});
      return;
    }

    const {cleanup} = connectDataTableExplorerCountClient({
      connection,
      store: dataTableExplorerStore,
      tableName: tableIdentity,
      tableReference,
      target: 'total',
    });

    return cleanup;
  }, [
    connection,
    dataTableExplorerStore,
    tableIdentity,
    tableName,
    tableReference,
  ]);

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
      tableReference,
    });
  }, [
    categoryLimit,
    connection,
    fields,
    dataTableExplorerStore,
    selection,
    summaryBins,
    tableIdentity,
    tableName,
    tableReference,
  ]);

  // Client is not returned - it's stored in the dataTableExplorerStore
  return {client: null};
}
