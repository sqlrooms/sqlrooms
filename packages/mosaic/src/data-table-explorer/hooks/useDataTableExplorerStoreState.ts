import {useState} from 'react';
import {useStore} from 'zustand';
import {
  createDataTableExplorerStore,
  type DataTableExplorerStore,
} from '../createDataTableExplorerStore';
import type {DataTableExplorerSorting} from '../types';
import type {DataTableExplorerStoreState} from '../createDataTableExplorerStore';

export type UseDataTableExplorerStoreStateOptions = {
  initialSorting: DataTableExplorerSorting;
  pageSize: number;
};

export type UseDataTableExplorerStoreStateReturn = {
  client: DataTableExplorerStoreState['client'];
  filteredCount: DataTableExplorerStoreState['filteredCount'];
  lastNonEmptyPageTable: DataTableExplorerStoreState['lastNonEmptyPageTable'];
  page: DataTableExplorerStoreState['page'];
  pagination: DataTableExplorerStoreState['pagination'];
  dataTableExplorerStore: DataTableExplorerStore;
  schema: DataTableExplorerStoreState['schema'];
  setPagination: DataTableExplorerStoreState['setPagination'];
  setSorting: DataTableExplorerStoreState['setSorting'];
  sorting: DataTableExplorerStoreState['sorting'];
  summaries: DataTableExplorerStoreState['summaries'];
  totalCount: DataTableExplorerStoreState['totalCount'];
};

/**
 * Creates the per-dataTableExplorer local store and subscribes to the raw state slices
 * that the public dataTableExplorer hook exposes.
 */
export function useDataTableExplorerStoreState(
  options: UseDataTableExplorerStoreStateOptions,
): UseDataTableExplorerStoreStateReturn {
  const [dataTableExplorerStore] = useState(() =>
    createDataTableExplorerStore({
      initialSorting: options.initialSorting,
      pageSize: options.pageSize,
    }),
  );

  return {
    client: useStore(dataTableExplorerStore, (state) => state.client),
    filteredCount: useStore(
      dataTableExplorerStore,
      (state) => state.filteredCount,
    ),
    lastNonEmptyPageTable: useStore(
      dataTableExplorerStore,
      (state) => state.lastNonEmptyPageTable,
    ),
    page: useStore(dataTableExplorerStore, (state) => state.page),
    pagination: useStore(dataTableExplorerStore, (state) => state.pagination),
    dataTableExplorerStore,
    schema: useStore(dataTableExplorerStore, (state) => state.schema),
    setPagination: useStore(
      dataTableExplorerStore,
      (state) => state.setPagination,
    ),
    setSorting: useStore(dataTableExplorerStore, (state) => state.setSorting),
    sorting: useStore(dataTableExplorerStore, (state) => state.sorting),
    summaries: useStore(dataTableExplorerStore, (state) => state.summaries),
    totalCount: useStore(dataTableExplorerStore, (state) => state.totalCount),
  };
}
