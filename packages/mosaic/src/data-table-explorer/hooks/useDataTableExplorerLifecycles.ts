import {useEffect, useRef} from 'react';
import type {MosaicClient, Selection} from '@uwdata/mosaic-core';
import type {MosaicSliceState} from '../../MosaicSlice';
import type {DataTableExplorerStore} from '../createDataTableExplorerStore';
import type {
  DataTableExplorerColumnKind,
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

/**
 * Inputs required to synchronize a dataTableExplorer instance with Mosaic
 * connection, selection, schema, row, count, and summary lifecycles.
 */
export type UseDataTableExplorerLifecyclesOptions = {
  categoryLimit: number;
  /**
   * Resolved summary kind per field name. Columns resolved to `'none'` get no
   * summary clients.
   */
  columnKinds?: Record<string, DataTableExplorerColumnKind>;
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
  /**
   * Stable SQLRooms table identity used for store keys, selection resets, and
   * dataset IDs. This should keep catalog/database identity when available.
   */
  tableIdentity: string;
  /**
   * String table reference used for readiness checks and legacy client inputs.
   */
  tableName: string;
  /**
   * Mosaic SQL table reference used by generated queries. Use a TableRefNode for
   * qualified names to preserve identifier boundaries such as dots inside table
   * names.
   */
  tableReference: DataTableExplorerSqlTableReference;
};

export type UseDataTableExplorerLifecyclesReturn = {
  client: MosaicClient | null;
};

/**
 * Owns the coordinator-backed schema, row, count, and summary client
 * lifecycles for a dataTableExplorer instance.
 *
 * The hook keeps SQLRooms identity state separate from Mosaic SQL references:
 * tableIdentity drives local store keys, while tableReference is used at query
 * boundaries.
 */
export function useDataTableExplorerLifecycles(
  options: UseDataTableExplorerLifecyclesOptions,
): UseDataTableExplorerLifecyclesReturn {
  const {
    categoryLimit,
    columnKinds,
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
      tableReference,
    });
  }, [
    columns,
    connection,
    dataTableExplorerStore,
    tableIdentity,
    tableName,
    tableReference,
  ]);

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
      columnKinds,
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
    columnKinds,
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
