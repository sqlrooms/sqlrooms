import {createId} from '@paralleldrive/cuid2';
import {type Selection} from '@uwdata/mosaic-core';
import {useEffect, useMemo, useRef, useState} from 'react';
import {useStore} from 'zustand';
import {useStoreWithMosaic} from './MosaicSlice';
import type {
  MosaicProfilerColumnState,
  MosaicProfilerOptions,
  UseMosaicProfilerReturn,
} from './profiler/types';
import {createProfilerStore} from './profiler/createProfilerStore';
import {
  connectProfilerCountClient,
  connectProfilerPageClient,
  connectProfilerSummaryClients,
  loadProfilerSchema,
} from './profiler/profilerController';
import {
  buildProfilerBaseQuery,
  buildProfilerPageQuery,
  createEmptySummaryState,
  isProfilerHistogramType,
  isProfilerUnsupportedSummaryType,
} from './profiler/utils';

function useSelectionVersion(selection: Selection) {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const handleChange = () => setVersion((value) => value + 1);
    selection.addEventListener('value', handleChange);
    return () => selection.removeEventListener('value', handleChange);
  }, [selection]);

  return version;
}

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

  const generatedSelectionName = useMemo(
    () => `mosaic-profiler-${createId()}`,
    [],
  );
  const getSelection = useStoreWithMosaic((state) => state.mosaic.getSelection);
  const connection = useStoreWithMosaic((state) => state.mosaic.connection);
  const selection = useMemo(
    () =>
      providedSelection ??
      getSelection(selectionName ?? generatedSelectionName, 'crossfilter'),
    [generatedSelectionName, getSelection, providedSelection, selectionName],
  );
  const selectionVersion = useSelectionVersion(selection);

  const storeRef = useRef(
    createProfilerStore({
      initialSorting,
      pageSize,
    }),
  );
  const profilerStore = storeRef.current;

  const pagination = useStore(profilerStore, (state) => state.pagination);
  const setPagination = useStore(profilerStore, (state) => state.setPagination);
  const sorting = useStore(profilerStore, (state) => state.sorting);
  const setSorting = useStore(profilerStore, (state) => state.setSorting);
  const schema = useStore(profilerStore, (state) => state.schema);
  const page = useStore(profilerStore, (state) => state.page);
  const filteredCount = useStore(profilerStore, (state) => state.filteredCount);
  const totalCount = useStore(profilerStore, (state) => state.totalCount);
  const summaries = useStore(profilerStore, (state) => state.summaries);

  useEffect(() => {
    profilerStore.getState().syncPageSize(pageSize);
  }, [pageSize, profilerStore]);

  useEffect(() => {
    profilerStore.getState().resetPageIndex();
  }, [profilerStore, selectionVersion, sorting, tableName]);

  useEffect(() => {
    if (connection.status !== 'ready' || !tableName) {
      profilerStore.getState().setSchemaSuccess([]);
      profilerStore.getState().setSchemaError(undefined);
      profilerStore.getState().setSchemaLoading(connection.status === 'loading');
      return;
    }

    let active = true;

    void loadProfilerSchema({
      columns,
      coordinator: connection.coordinator,
      store: profilerStore,
      tableName,
    }).catch(() => {
      if (!active) {
        return;
      }
    });

    return () => {
      active = false;
    };
  }, [columns, connection, profilerStore, tableName]);

  const fields = schema.fields;
  const fieldNames = useMemo(() => fields.map((field) => field.name), [fields]);
  const fieldSignature = useMemo(
    () => fields.map((field) => `${field.name}:${field.type}`).join('|'),
    [fields],
  );

  const baseQuery = useMemo(
    () =>
      buildProfilerBaseQuery({
        columns: fieldNames,
        filter: selection.predicate(),
        sorting,
        tableName,
      }),
    [fieldNames, selection, selectionVersion, sorting, tableName],
  );
  const pageQuery = useMemo(
    () => buildProfilerPageQuery(baseQuery, pagination).toString(),
    [baseQuery, pagination],
  );

  useEffect(() => {
    if (connection.status !== 'ready' || !tableName || !fieldNames.length) {
      profilerStore.getState().setPage({isLoading: false});
      return;
    }

    return connectProfilerPageClient({
      connection,
      fieldNames,
      pagination,
      selection,
      sorting,
      store: profilerStore,
      tableName,
    });
  }, [
    connection,
    fieldNames,
    fieldSignature,
    pagination,
    profilerStore,
    selection,
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
    fieldSignature,
    profilerStore,
    selection,
    summaryBins,
    tableName,
  ]);

  const profilerColumns = useMemo<MosaicProfilerColumnState[]>(
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

  const isLoading =
    schema.isLoading ||
    page.isLoading ||
    filteredCount.isLoading ||
    totalCount.isLoading;

  const tableError =
    schema.error ??
    page.error ??
    filteredCount.error ??
    totalCount.error ??
    Object.values(summaries).find((summary) => summary.error)?.error;

  return {
    columns: profilerColumns,
    filteredRowCount: filteredCount.count,
    isLoading,
    pageQuery,
    pageTable: page.pageTable,
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
