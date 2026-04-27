import {createId} from '@paralleldrive/cuid2';
import {useDebounce} from '@sqlrooms/ui';
import {
  Selection as MosaicSelection,
  type Selection,
} from '@uwdata/mosaic-core';
import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import {useStore} from 'zustand';
import {type MosaicSliceState, useStoreWithMosaic} from '../MosaicSlice';
import type {
  MosaicProfilerColumnState,
  MosaicProfilerOptions,
  MosaicProfilerPaginationState,
  MosaicProfilerSorting,
  UseMosaicProfilerReturn,
} from './types';
import {
  createProfilerStore,
  type ProfilerStore,
  type ProfilerStoreState,
} from './createProfilerStore';
import {
  connectProfilerCountClient,
  connectProfilerPageClient,
  connectProfilerSummaryClients,
  loadProfilerSchema,
} from './profilerController';
import {
  buildProfilerBaseQuery,
  buildProfilerPageQuery,
  createEmptySummaryState,
  isProfilerHistogramType,
  isProfilerUnsupportedSummaryType,
} from './utils';

type ProfilerSelectionState = {
  selection: Selection;
  selectionVersion: number;
};

type ProfilerStoreSlice = {
  filteredCount: ProfilerStoreState['filteredCount'];
  lastNonEmptyPageTable: ProfilerStoreState['lastNonEmptyPageTable'];
  page: ProfilerStoreState['page'];
  pagination: MosaicProfilerPaginationState;
  profilerStore: ProfilerStore;
  schema: ProfilerStoreState['schema'];
  setPagination: Dispatch<SetStateAction<MosaicProfilerPaginationState>>;
  setSorting: Dispatch<SetStateAction<MosaicProfilerSorting>>;
  sorting: MosaicProfilerSorting;
  summaries: ProfilerStoreState['summaries'];
  totalCount: ProfilerStoreState['totalCount'];
};

type ProfilerQueryState = {
  baseQuery: ReturnType<typeof buildProfilerBaseQuery>;
  datasetId: string;
  fieldNames: string[];
  fields: ProfilerStoreState['schema']['fields'];
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
 * Resolves the profiler selection, creating a crossfilter selection when the
 * caller does not supply one, and exposes a version that changes with it.
 */
function useProfilerSelection(
  options: Pick<MosaicProfilerOptions, 'selection' | 'selectionName'>,
): ProfilerSelectionState {
  const {selection: providedSelection, selectionName} = options;
  const generatedSelectionName = useMemo(
    () => `mosaic-profiler-${createId()}`,
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

  const selection =
    providedSelection ?? existingSelection ?? fallbackSelection;

  return {
    selection,
    selectionVersion: useSelectionVersion(selection),
  };
}

/**
 * Creates the per-profiler local store and subscribes to the raw state slices
 * that the public profiler hook exposes.
 */
function useProfilerStoreState(options: {
  initialSorting: MosaicProfilerSorting;
  pageSize: number;
}): ProfilerStoreSlice {
  const [profilerStore] = useState(() =>
    createProfilerStore({
      initialSorting: options.initialSorting,
      pageSize: options.pageSize,
    }),
  );

  return {
    filteredCount: useStore(profilerStore, (state) => state.filteredCount),
    lastNonEmptyPageTable: useStore(
      profilerStore,
      (state) => state.lastNonEmptyPageTable,
    ),
    page: useStore(profilerStore, (state) => state.page),
    pagination: useStore(profilerStore, (state) => state.pagination),
    profilerStore,
    schema: useStore(profilerStore, (state) => state.schema),
    setPagination: useStore(profilerStore, (state) => state.setPagination),
    setSorting: useStore(profilerStore, (state) => state.setSorting),
    sorting: useStore(profilerStore, (state) => state.sorting),
    summaries: useStore(profilerStore, (state) => state.summaries),
    totalCount: useStore(profilerStore, (state) => state.totalCount),
  };
}

/**
 * Derives the profiler's field and SQL state from the current schema,
 * selection, sorting, and pagination state.
 */
function useProfilerQueryState(options: {
  pagination: MosaicProfilerPaginationState;
  rowSelectionVersion: number;
  schema: ProfilerStoreState['schema'];
  selection: Selection;
  selectionVersion: number;
  sorting: MosaicProfilerSorting;
  tableName: string;
}): ProfilerQueryState {
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
      buildProfilerBaseQuery({
        columns: fieldNames,
        filter,
        sorting,
        tableName,
      }),
    [fieldNames, filter, sorting, tableName],
  );
  const pageBaseQuery = useMemo(
    () =>
      buildProfilerBaseQuery({
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
    pageQuery: buildProfilerPageQuery(pageBaseQuery, pagination).toString(),
    rowFilter,
  };
}

/**
 * Owns the coordinator-backed schema, row, count, and summary client
 * lifecycles for a profiler instance.
 */
function useProfilerLifecycles(options: {
  categoryLimit: number;
  columns?: string[];
  connection: MosaicSliceState['mosaic']['connection'];
  fieldNames: string[];
  fields: ProfilerStoreState['schema']['fields'];
  pageSize: number;
  pagination: MosaicProfilerPaginationState;
  profilerStore: ProfilerStore;
  rowFilter: ReturnType<Selection['predicate']>;
  selection: Selection;
  selectionVersion: number;
  sorting: MosaicProfilerSorting;
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
    profilerStore,
    rowFilter,
    selection,
    selectionVersion,
    sorting,
    summaryBins,
    tableName,
  } = options;

  useEffect(() => {
    profilerStore.getState().syncPageSize(pageSize);
  }, [pageSize, profilerStore]);

  useEffect(() => {
    profilerStore.getState().resetPageIndex();
  }, [profilerStore, selectionVersion, tableName]);

  useEffect(() => {
    if (connection.status !== 'ready' || !tableName) {
      profilerStore.getState().setSchemaSuccess([]);
      profilerStore.getState().setSchemaError(undefined);
      profilerStore
        .getState()
        .setSchemaLoading(connection.status === 'loading');
      return;
    }

    void loadProfilerSchema({
      columns,
      coordinator: connection.coordinator,
      store: profilerStore,
      tableName,
    });
  }, [columns, connection, profilerStore, tableName]);

  useEffect(() => {
    if (connection.status !== 'ready' || !tableName || !fieldNames.length) {
      profilerStore.getState().setPage({isLoading: false});
      return;
    }

    return connectProfilerPageClient({
      connection,
      fieldNames,
      filter: rowFilter,
      pagination,
      sorting,
      store: profilerStore,
      tableName,
    });
  }, [
    connection,
    fieldNames,
    pagination,
    profilerStore,
    rowFilter,
    sorting,
    tableName,
  ]);

  useEffect(() => {
    if (connection.status !== 'ready' || !tableName) {
      profilerStore.getState().setFilteredCount({isLoading: false});
      return;
    }

    return connectProfilerCountClient({
      connection,
      filterStable: true,
      selection,
      store: profilerStore,
      tableName,
      target: 'filtered',
    });
  }, [connection, profilerStore, selection, tableName]);

  useEffect(() => {
    if (connection.status !== 'ready' || !tableName) {
      profilerStore.getState().setTotalCount({isLoading: false});
      return;
    }

    return connectProfilerCountClient({
      connection,
      store: profilerStore,
      tableName,
      target: 'total',
    });
  }, [connection, profilerStore, tableName]);

  useEffect(() => {
    if (connection.status !== 'ready' || !fields.length) {
      profilerStore.getState().clearSummaries();
      return;
    }

    return connectProfilerSummaryClients({
      categoryLimit,
      connection,
      fields,
      selection,
      store: profilerStore,
      summaryBins,
      tableName,
    });
  }, [
    categoryLimit,
    connection,
    fields,
    profilerStore,
    selection,
    summaryBins,
    tableName,
  ]);
}

/**
 * Maps the schema fields and summary state into the column model consumed by
 * the profiler header and summary cells.
 */
function useProfilerColumns(options: {
  fields: ProfilerStoreState['schema']['fields'];
  summaries: ProfilerStoreState['summaries'];
}) {
  const {fields, summaries} = options;

  return useMemo<MosaicProfilerColumnState[]>(
    () =>
      fields.map((field) => ({
        field,
        kind: isProfilerUnsupportedSummaryType(field.type)
          ? 'unsupported'
          : isProfilerHistogramType(field.type)
            ? 'histogram'
            : 'category',
        name: field.name,
        summary: summaries[field.name] ?? createEmptySummaryState(field),
      })),
    [fields, summaries],
  );
}

/**
 * Collapses the aggregated profiler client state into the loading and error
 * signals exposed from the public hook.
 */
function useProfilerStatus(options: {
  filteredCount: ProfilerStoreState['filteredCount'];
  fields: ProfilerStoreState['schema']['fields'];
  page: ProfilerStoreState['page'];
  schema: ProfilerStoreState['schema'];
  summaries: ProfilerStoreState['summaries'];
  totalCount: ProfilerStoreState['totalCount'];
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
function useProfilerVisiblePageState(options: {
  lastNonEmptyPageTable: ProfilerStoreState['lastNonEmptyPageTable'];
  pageDatasetId: string;
  page: ProfilerStoreState['page'];
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

/**
 * Aggregates Mosaic-backed schema, rows, counts, and summaries into the stable
 * public profiler API consumed by the React table UI.
 */
export function useMosaicProfiler(
  options: MosaicProfilerOptions,
): UseMosaicProfilerReturn {
  const {
    categoryLimit = 20,
    columns,
    initialSorting = [],
    pageSize = 100,
    selection: providedSelection,
    selectionName,
    summaryBins = 18,
    tableName,
  } = options;

  const connection = useStoreWithMosaic((state) => state.mosaic.connection);
  const {selection, selectionVersion} = useProfilerSelection({
    selection: providedSelection,
    selectionName,
  });
  const rowSelectionVersion = useDebounce(selectionVersion, 100);
  const {
    filteredCount,
    lastNonEmptyPageTable,
    page,
    pagination,
    profilerStore,
    schema,
    setPagination,
    setSorting,
    sorting,
    summaries,
    totalCount,
  } = useProfilerStoreState({
    initialSorting,
    pageSize,
  });
  const {
    baseQuery,
    datasetId,
    fieldNames,
    fields,
    hasFilters,
    pageQuery,
    rowFilter,
  } = useProfilerQueryState({
    pagination,
    rowSelectionVersion,
    schema,
    selection,
    selectionVersion,
    sorting,
    tableName,
  });
  useProfilerLifecycles({
    categoryLimit,
    columns,
    connection,
    fieldNames,
    fields,
    pageSize,
    pagination,
    profilerStore,
    rowFilter,
    selection,
    selectionVersion,
    sorting,
    summaryBins,
    tableName,
  });
  const profilerColumns = useProfilerColumns({fields, summaries});
  const {isLoading, tableError} = useProfilerStatus({
    fields,
    filteredCount,
    page,
    schema,
    summaries,
    totalCount,
  });
  const visiblePage = useProfilerVisiblePageState({
    lastNonEmptyPageTable,
    page,
    pageDatasetId: datasetId,
    rowSelectionVersion,
    selectionVersion,
  });

  return {
    columns: profilerColumns,
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
