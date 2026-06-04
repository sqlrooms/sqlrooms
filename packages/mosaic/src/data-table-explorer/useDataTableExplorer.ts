import {createId} from '@paralleldrive/cuid2';
import {useDebounce} from '@sqlrooms/ui';
import {
  Selection as MosaicSelection,
  type Selection,
} from '@uwdata/mosaic-core';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import {useStore} from 'zustand';
import {useStoreWithMosaic, type MosaicSliceState} from '../MosaicSlice';
import {
  createDataTableExplorerStore,
  type DataTableExplorerStore,
  type DataTableExplorerStoreState,
} from './createDataTableExplorerStore';
import {
  connectDataTableExplorerCountClient,
  connectDataTableExplorerPageClient,
  connectDataTableExplorerSummaryClients,
  loadDataTableExplorerSchema,
} from './dataTableExplorerController';
import type {
  DataTableExplorerColumnState,
  DataTableExplorerOptions,
  DataTableExplorerPaginationState,
  DataTableExplorerSorting,
  UseDataTableExplorerReturn,
} from './types';
import {
  buildDataTableExplorerBaseQuery,
  buildDataTableExplorerPageQuery,
  createEmptySummaryState,
  isDataTableExplorerHistogramType,
  isDataTableExplorerUnsupportedSummaryType,
} from './utils';
import {DataTable} from '@sqlrooms/db';

type DataTableExplorerSelectionState = {
  selection: Selection;
  selectionVersion: number;
};

type DataTableExplorerStoreSlice = {
  filteredCount: DataTableExplorerStoreState['filteredCount'];
  lastNonEmptyPageTable: DataTableExplorerStoreState['lastNonEmptyPageTable'];
  page: DataTableExplorerStoreState['page'];
  pagination: DataTableExplorerPaginationState;
  dataTableExplorerStore: DataTableExplorerStore;
  schema: DataTableExplorerStoreState['schema'];
  setPagination: Dispatch<SetStateAction<DataTableExplorerPaginationState>>;
  setSorting: Dispatch<SetStateAction<DataTableExplorerSorting>>;
  sorting: DataTableExplorerSorting;
  summaries: DataTableExplorerStoreState['summaries'];
  totalCount: DataTableExplorerStoreState['totalCount'];
};

type DataTableExplorerQueryState = {
  baseQuery: ReturnType<typeof buildDataTableExplorerBaseQuery>;
  datasetId: string;
  fieldNames: string[];
  fields: DataTableExplorerStoreState['schema']['fields'];
  hasFilters: boolean;
  pageQuery: string;
  rowFilter: ReturnType<Selection['predicate']>;
};

/**
 * Tracks Mosaic selection updates as a monotonically increasing version so
 * memoized queries and lifecycle effects can respond to crossfilter changes.
 */
function useSelectionVersion(selection: Selection) {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const handleChange = () => setVersion((value) => value + 1);
    selection.addEventListener('value', handleChange);
    return () => selection.removeEventListener('value', handleChange);
  }, [selection]);

  return version;
}

/**
 * Resolves the dataTableExplorer selection, creating a crossfilter selection when the
 * caller does not supply one, and exposes a version that changes with it.
 */
function useDataTableExplorerSelection(
  options: Pick<DataTableExplorerOptions, 'selection' | 'selectionName'>,
): DataTableExplorerSelectionState {
  const {selection: providedSelection, selectionName} = options;
  const generatedSelectionName = useMemo(
    () => `mosaic-data-table-explorer-${createId()}`,
    [],
  );
  const selectionKey = selectionName ?? generatedSelectionName;
  const existingSelection = useStoreWithMosaic(
    (state) => state.mosaic.selections[selectionKey],
  );
  const getSelection = useStoreWithMosaic((state) => state.mosaic.getSelection);
  const [fallbackSelection] = useState(() => MosaicSelection.crossfilter());

  useEffect(() => {
    if (!providedSelection && !existingSelection) {
      getSelection(selectionKey, 'crossfilter');
    }
  }, [existingSelection, getSelection, providedSelection, selectionKey]);

  const selection = providedSelection ?? existingSelection ?? fallbackSelection;

  return {
    selection,
    selectionVersion: useSelectionVersion(selection),
  };
}

/**
 * Creates the per-dataTableExplorer local store and subscribes to the raw state slices
 * that the public dataTableExplorer hook exposes.
 */
function useDataTableExplorerStoreState(options: {
  initialSorting: DataTableExplorerSorting;
  pageSize: number;
}): DataTableExplorerStoreSlice {
  const [dataTableExplorerStore] = useState(() =>
    createDataTableExplorerStore({
      initialSorting: options.initialSorting,
      pageSize: options.pageSize,
    }),
  );

  return {
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

/**
 * Derives the dataTableExplorer's field and SQL state from the current schema,
 * selection, sorting, and pagination state.
 */
function useDataTableExplorerQueryState(options: {
  pagination: DataTableExplorerPaginationState;
  rowSelectionVersion: number;
  schema: DataTableExplorerStoreState['schema'];
  selection: Selection;
  selectionVersion: number;
  sorting: DataTableExplorerSorting;
  tableName: string;
}): DataTableExplorerQueryState {
  const {
    pagination,
    rowSelectionVersion,
    schema,
    selection,
    selectionVersion,
    sorting,
    tableName,
  } = options;
  const fields = schema.fields;
  const fieldNames = useMemo(() => fields.map((field) => field.name), [fields]);
  const filter = useMemo(() => {
    void selectionVersion;
    return selection.predicate();
  }, [selection, selectionVersion]);
  const rowFilter = useMemo(() => {
    void rowSelectionVersion;
    return selection.predicate();
  }, [rowSelectionVersion, selection]);
  const baseQuery = useMemo(
    () =>
      buildDataTableExplorerBaseQuery({
        columns: fieldNames,
        filter,
        sorting,
        tableName,
      }),
    [fieldNames, filter, sorting, tableName],
  );
  const pageBaseQuery = useMemo(
    () =>
      buildDataTableExplorerBaseQuery({
        columns: fieldNames,
        filter: rowFilter,
        sorting,
        tableName,
      }),
    [fieldNames, rowFilter, sorting, tableName],
  );

  return {
    baseQuery,
    datasetId: [tableName, ...fieldNames].join('\u0001'),
    fieldNames,
    fields,
    hasFilters: Array.isArray(filter) ? filter.length > 0 : Boolean(filter),
    pageQuery: buildDataTableExplorerPageQuery(
      pageBaseQuery,
      pagination,
    ).toString(),
    rowFilter,
  };
}

/**
 * Owns the coordinator-backed schema, row, count, and summary client
 * lifecycles for a dataTableExplorer instance.
 */
function useDataTableExplorerLifecycles(options: {
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
}) {
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
      return;
    }

    return connectDataTableExplorerCountClient({
      connection,
      filterStable: true,
      selection,
      store: dataTableExplorerStore,
      tableName,
      target: 'filtered',
    });
  }, [connection, dataTableExplorerStore, selection, tableName]);

  useEffect(() => {
    if (connection.status !== 'ready' || !tableName) {
      dataTableExplorerStore.getState().setTotalCount({isLoading: false});
      return;
    }

    return connectDataTableExplorerCountClient({
      connection,
      store: dataTableExplorerStore,
      tableName,
      target: 'total',
    });
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
}

/**
 * Maps the schema fields and summary state into the column model consumed by
 * the dataTableExplorer header and summary cells.
 */
function useDataTableExplorerColumns(options: {
  fields: DataTableExplorerStoreState['schema']['fields'];
  summaries: DataTableExplorerStoreState['summaries'];
}) {
  const {fields, summaries} = options;

  return useMemo<DataTableExplorerColumnState[]>(
    () =>
      fields.map((field) => ({
        field,
        kind: isDataTableExplorerUnsupportedSummaryType(field.type)
          ? 'unsupported'
          : isDataTableExplorerHistogramType(field.type)
            ? 'histogram'
            : 'category',
        name: field.name,
        summary: summaries[field.name] ?? createEmptySummaryState(field),
      })),
    [fields, summaries],
  );
}

/**
 * Collapses the aggregated dataTableExplorer client state into the loading and error
 * signals exposed from the public hook.
 */
function useDataTableExplorerStatus(options: {
  filteredCount: DataTableExplorerStoreState['filteredCount'];
  fields: DataTableExplorerStoreState['schema']['fields'];
  page: DataTableExplorerStoreState['page'];
  schema: DataTableExplorerStoreState['schema'];
  summaries: DataTableExplorerStoreState['summaries'];
  totalCount: DataTableExplorerStoreState['totalCount'];
}) {
  const {fields, filteredCount, page, schema, summaries, totalCount} = options;
  const hasPendingSummaryInitialization =
    fields.length > 0 && Object.keys(summaries).length < fields.length;

  return {
    isLoading:
      schema.isLoading ||
      page.isLoading ||
      filteredCount.isLoading ||
      totalCount.isLoading ||
      hasPendingSummaryInitialization ||
      Object.values(summaries).some((summary) => summary.isLoading),
    tableError:
      schema.error ??
      page.error ??
      filteredCount.error ??
      totalCount.error ??
      Object.values(summaries).find((summary) => summary.error)?.error,
  };
}

/**
 * Keeps the last non-empty page result visible while live brushing has moved
 * ahead of the deferred row query, avoiding transient "No rows" flashes.
 */
function useDataTableExplorerVisiblePageState(options: {
  lastNonEmptyPageTable: DataTableExplorerStoreState['lastNonEmptyPageTable'];
  pageDatasetId: string;
  page: DataTableExplorerStoreState['page'];
  rowSelectionVersion: number;
  selectionVersion: number;
}) {
  const {
    lastNonEmptyPageTable,
    page,
    pageDatasetId,
    rowSelectionVersion,
    selectionVersion,
  } = options;
  const isRowDisplayStale = selectionVersion !== rowSelectionVersion;
  const hasCurrentRows = !!page.pageTable && page.pageTable.numRows > 0;
  const canReuseLastNonEmptyPage =
    !!lastNonEmptyPageTable &&
    lastNonEmptyPageTable.datasetId === pageDatasetId;
  const canShowStableEmpty =
    !page.isLoading &&
    !isRowDisplayStale &&
    (!page.pageTable || page.pageTable.numRows === 0);
  const showStableEmpty = useDebounce(canShowStableEmpty, 120);

  if (hasCurrentRows || !canReuseLastNonEmptyPage) {
    return page.pageTable;
  }

  return showStableEmpty ? page.pageTable : lastNonEmptyPageTable.pageTable;
}

function getTableReference(table: DataTable): string {
  return [table.table.database, table.table.schema, table.table.table]
    .filter((part): part is string => Boolean(part))
    .join('.');
}

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

  const tableName = getTableReference(table);

  const connection = useStoreWithMosaic((state) => state.mosaic.connection);
  const {selection, selectionVersion} = useDataTableExplorerSelection({
    selection: providedSelection,
    selectionName,
  });
  const rowSelectionVersion = useDebounce(selectionVersion, 100);
  const {
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
    rawSchema.tableName === tableName
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
    tableName,
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
    tableName,
  });
  const dataTableExplorerColumns = useDataTableExplorerColumns({
    fields,
    summaries,
  });
  const {isLoading, tableError} = useDataTableExplorerStatus({
    fields,
    filteredCount,
    page,
    schema,
    summaries,
    totalCount,
  });
  const visiblePage = useDataTableExplorerVisiblePageState({
    lastNonEmptyPageTable,
    page,
    pageDatasetId: datasetId,
    rowSelectionVersion,
    selectionVersion,
  });

  return {
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
