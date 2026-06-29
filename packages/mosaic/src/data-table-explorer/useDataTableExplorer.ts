import {useDebounce} from '@sqlrooms/ui';
import {useMemo} from 'react';
import {useStoreWithMosaic} from '../MosaicSlice';
import type {
  DataTableExplorerOptions,
  UseDataTableExplorerReturn,
} from './types';
import {useDataTableExplorerSelection} from './hooks/useDataTableExplorerSelection';
import {useDataTableExplorerStoreState} from './hooks/useDataTableExplorerStoreState';
import {useDataTableExplorerQueryState} from './hooks/useDataTableExplorerQueryState';
import {useDataTableExplorerLifecycles} from './hooks/useDataTableExplorerLifecycles';
import {useDataTableExplorerColumns} from './hooks/useDataTableExplorerColumns';
import {useDataTableExplorerStatus} from './hooks/useDataTableExplorerStatus';
import {useDataTableExplorerVisiblePage} from './hooks/useDataTableExplorerVisiblePage';
import {
  getMosaicRawSqlTableReference,
  getMosaicSqlTableReference,
  getMosaicTableIdentity,
} from '../mosaicTableReference';

/**
 * Aggregates Mosaic-backed schema, rows, counts, and summaries into the stable
 * public dataTableExplorer API consumed by the React table UI.
 */
export function useDataTableExplorer(
  options: DataTableExplorerOptions,
): UseDataTableExplorerReturn {
  const {
    categoryLimit = 20,
    columns,
    initialSorting = [],
    pageSize = 100,
    selection: providedSelection,
    selectionName,
    summaryBins = 18,
    tableName: table,
  } = options;

  const tableIdentity = useMemo(() => getMosaicTableIdentity(table), [table]);
  const tableName = useMemo(
    () => getMosaicRawSqlTableReference(table),
    [table],
  );
  const tableReference = useMemo(
    () => getMosaicSqlTableReference(table),
    [table],
  );

  const connection = useStoreWithMosaic((state) => state.mosaic.connection);
  const {selection, selectionVersion} = useDataTableExplorerSelection({
    selection: providedSelection,
    selectionName,
  });
  const rowSelectionVersion = useDebounce(selectionVersion, 100);
  const {
    client,
    filteredCount,
    lastNonEmptyPageTable,
    page,
    pagination,
    dataTableExplorerStore,
    schema: rawSchema,
    setPagination,
    setSorting,
    sorting,
    summaries,
    totalCount,
  } = useDataTableExplorerStoreState({
    initialSorting,
    pageSize,
  });
  const schema =
    rawSchema.tableName === tableIdentity
      ? rawSchema
      : {...rawSchema, fields: [], isLoading: true};
  const {
    baseQuery,
    datasetId,
    fieldNames,
    fields,
    hasFilters,
    pageQuery,
    rowFilter,
  } = useDataTableExplorerQueryState({
    pagination,
    rowSelectionVersion,
    schema,
    selection,
    selectionVersion,
    sorting,
    tableIdentity,
    tableReference,
  });
  useDataTableExplorerLifecycles({
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
  });
  const dataTableExplorerColumns = useDataTableExplorerColumns({
    fields,
    summaries,
  });
  const {isLoading, tableError} = useDataTableExplorerStatus({
    filteredCount,
    page,
    schema,
    summaries,
    totalCount,
  });
  const visiblePage = useDataTableExplorerVisiblePage({
    lastNonEmptyPageTable,
    page,
    pageDatasetId: datasetId,
    rowSelectionVersion,
    selectionVersion,
  });

  return {
    client,
    columns: dataTableExplorerColumns,
    filteredRowCount: filteredCount.count,
    hasFilters,
    isLoading,
    pageQuery,
    pageTable: visiblePage,
    pagination,
    reset: () => selection.reset(),
    selection,
    setPagination,
    setSorting,
    sorting,
    sql: baseQuery.toString(),
    tableError,
    totalRowCount: totalCount.count,
  };
}
