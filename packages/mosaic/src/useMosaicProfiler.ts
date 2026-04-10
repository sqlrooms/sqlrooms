import {createId} from '@paralleldrive/cuid2';
import {useSql} from '@sqlrooms/duckdb';
import {type MosaicClient, type Selection} from '@uwdata/mosaic-core';
import {useEffect, useMemo, useState} from 'react';
import {useStoreWithMosaic} from './MosaicSlice';
import {ProfilerCategoryClient} from './profiler/ProfilerCategoryClient';
import {ProfilerHistogramClient} from './profiler/ProfilerHistogramClient';
import {ProfilerUnsupportedSummaryClient} from './profiler/ProfilerUnsupportedSummaryClient';
import type {
  MosaicProfilerColumnState,
  MosaicProfilerOptions,
  MosaicProfilerPaginationState,
  MosaicProfilerSorting,
  MosaicProfilerSummaryState,
  UseMosaicProfilerReturn,
} from './profiler/types';
import {
  buildCountQuery,
  buildProfilerBaseQuery,
  buildProfilerPageQuery,
  buildSchemaQuery,
  createEmptySummaryState,
  getProfilerValueType,
  isProfilerHistogramType,
  isProfilerUnsupportedSummaryType,
} from './profiler/utils';

function readCount(result?: {getRow(index: number): unknown}) {
  return (result?.getRow(0) as {count?: number} | undefined)?.count;
}

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

  const [pagination, setPagination] = useState<MosaicProfilerPaginationState>({
    pageIndex: 0,
    pageSize,
  });
  const [sorting, setSorting] = useState<MosaicProfilerSorting>(initialSorting);
  const [summaries, setSummaries] = useState<
    Record<string, MosaicProfilerSummaryState>
  >({});

  useEffect(() => {
    setPagination((prev) =>
      prev.pageSize === pageSize ? prev : {pageIndex: 0, pageSize},
    );
  }, [pageSize]);

  useEffect(() => {
    setPagination((prev) =>
      prev.pageIndex === 0 ? prev : {...prev, pageIndex: 0},
    );
  }, [selectionVersion, sorting, tableName]);

  const schemaQuery = useMemo(
    () => buildSchemaQuery(tableName, columns).toString(),
    [columns, tableName],
  );
  const schemaResult = useSql({
    enabled: !!tableName,
    query: schemaQuery,
  });
  const fields = schemaResult.data?.arrowTable?.schema.fields ?? [];
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
  const rowResult = useSql({
    enabled: fields.length > 0,
    query: pageQuery,
    version: selectionVersion,
  });
  const filteredCountResult = useSql({
    enabled: !!tableName,
    query: buildCountQuery({
      filter: selection.predicate(),
      tableName,
    }).toString(),
    version: selectionVersion,
  });
  const totalCountResult = useSql({
    enabled: !!tableName,
    query: buildCountQuery({tableName}).toString(),
  });

  useEffect(() => {
    if (connection.status !== 'ready' || !fields.length) {
      setSummaries({});
      return;
    }

    let active = true;
    const clients: MosaicClient[] = fields.flatMap((field): MosaicClient[] => {
      const update = (summary: MosaicProfilerSummaryState) => {
        if (!active) return;
        setSummaries((prev) => ({...prev, [field.name]: summary}));
      };

      if (isProfilerUnsupportedSummaryType(field.type)) {
        return [
          new ProfilerUnsupportedSummaryClient({
            field,
            onStateChange: update,
            selection,
            tableName,
          }),
        ];
      }

      if (isProfilerHistogramType(field.type)) {
        return [
          new ProfilerHistogramClient({
            field,
            onStateChange: update,
            selection,
            steps: summaryBins,
            tableName,
            valueType:
              getProfilerValueType(field.type) === 'date' ? 'date' : 'number',
          }),
        ];
      }

      return [
        new ProfilerCategoryClient({
          field,
          onStateChange: update,
          tableName,
          categoryLimit,
          selection,
        }),
      ];
    });

    setSummaries(
      Object.fromEntries(
        fields.map((field) => [field.name, createEmptySummaryState(field)]),
      ),
    );

    clients.forEach((client) => connection.coordinator.connect(client));

    return () => {
      active = false;
      clients.forEach((client) => connection.coordinator.disconnect(client));
    };
  }, [
    categoryLimit,
    connection,
    fieldSignature,
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

  return {
    columns: profilerColumns,
    filteredRowCount: readCount(filteredCountResult.data),
    isLoading:
      schemaResult.isLoading ||
      rowResult.isLoading ||
      filteredCountResult.isLoading ||
      totalCountResult.isLoading,
    pageQuery,
    pageTable: rowResult.data?.arrowTable,
    pagination,
    reset: () => selection.reset(),
    selection,
    setPagination,
    setSorting,
    sorting,
    sql: baseQuery.toString(),
    tableError:
      schemaResult.error ??
      rowResult.error ??
      filteredCountResult.error ??
      totalCountResult.error ??
      Object.values(summaries).find((summary) => summary.error)?.error,
    totalRowCount: readCount(totalCountResult.data),
  };
}
