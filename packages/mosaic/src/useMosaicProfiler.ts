import {createId} from '@paralleldrive/cuid2';
import {
  queryFieldInfo,
  type MosaicClient,
  type Selection,
} from '@uwdata/mosaic-core';
import * as arrow from 'apache-arrow';
import {useEffect, useMemo, useState} from 'react';
import {useStoreWithMosaic} from './MosaicSlice';
import {
  ProfilerCategoryClient,
  ProfilerCategoryTotalClient,
} from './profiler/ProfilerCategoryClient';
import {
  ProfilerCountClient,
  type ProfilerCountState,
} from './profiler/ProfilerCountClient';
import {
  ProfilerHistogramClient,
  ProfilerHistogramTotalClient,
} from './profiler/ProfilerHistogramClient';
import {
  ProfilerPageClient,
  type ProfilerPageState,
} from './profiler/ProfilerPageClient';
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
  buildProfilerBaseQuery,
  buildProfilerPageQuery,
  createEmptySummaryState,
  fieldInfoToProfilerField,
  getProfilerValueType,
  isProfilerHistogramType,
  isProfilerUnsupportedSummaryType,
} from './profiler/utils';

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
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
  const [fields, setFields] = useState<arrow.Field[]>([]);
  const [schemaError, setSchemaError] = useState<Error>();
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [pageState, setPageState] = useState<ProfilerPageState>({
    isLoading: false,
  });
  const [filteredCountState, setFilteredCountState] =
    useState<ProfilerCountState>({
      isLoading: false,
    });
  const [totalCountState, setTotalCountState] = useState<ProfilerCountState>({
    isLoading: false,
  });
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

  useEffect(() => {
    if (connection.status !== 'ready' || !tableName) {
      setFields([]);
      setSchemaError(undefined);
      setSchemaLoading(connection.status === 'loading');
      return;
    }

    let active = true;
    setSchemaLoading(true);
    setSchemaError(undefined);

    queryFieldInfo(
      connection.coordinator,
      columns?.length
        ? columns.map((column) => ({column, table: tableName}))
        : [{column: '*', table: tableName}],
    )
      .then((fieldInfo) => {
        if (!active) return;
        setFields(fieldInfo.map(fieldInfoToProfilerField));
        setSchemaLoading(false);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setFields([]);
        setSchemaError(toError(error));
        setSchemaLoading(false);
      });

    return () => {
      active = false;
    };
  }, [columns, connection, tableName]);

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
      setPageState({isLoading: false});
      return;
    }

    let active = true;
    const client = new ProfilerPageClient({
      columns: fieldNames,
      onStateChange: (state) => {
        if (active) {
          setPageState(state);
        }
      },
      pagination,
      selection,
      sorting,
      tableName,
    });

    connection.coordinator.connect(client);

    return () => {
      active = false;
      connection.coordinator.disconnect(client);
    };
  }, [connection, fieldSignature, fieldNames, pagination, selection, sorting, tableName]);

  useEffect(() => {
    if (connection.status !== 'ready' || !tableName) {
      setFilteredCountState({isLoading: false});
      return;
    }

    let active = true;
    const client = new ProfilerCountClient({
      filterStable: true,
      onStateChange: (state) => {
        if (active) {
          setFilteredCountState(state);
        }
      },
      selection,
      tableName,
    });

    connection.coordinator.connect(client);

    return () => {
      active = false;
      connection.coordinator.disconnect(client);
    };
  }, [connection, selection, tableName]);

  useEffect(() => {
    if (connection.status !== 'ready' || !tableName) {
      setTotalCountState({isLoading: false});
      return;
    }

    let active = true;
    const client = new ProfilerCountClient({
      onStateChange: (state) => {
        if (active) {
          setTotalCountState(state);
        }
      },
      tableName,
    });

    connection.coordinator.connect(client);

    return () => {
      active = false;
      connection.coordinator.disconnect(client);
    };
  }, [connection, tableName]);

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
        const summaryClient = new ProfilerHistogramClient({
          field,
          onStateChange: update,
          selection,
          steps: summaryBins,
          tableName,
          valueType:
            getProfilerValueType(field.type) === 'date' ? 'date' : 'number',
        });

        return [
          summaryClient,
          new ProfilerHistogramTotalClient({
            summaryClient,
          }),
        ];
      }

      const summaryClient = new ProfilerCategoryClient({
        field,
        onStateChange: update,
        tableName,
        categoryLimit,
        selection,
      });

      return [
        summaryClient,
        new ProfilerCategoryTotalClient({
          summaryClient,
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
    fields,
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
    filteredRowCount: filteredCountState.count,
    isLoading:
      schemaLoading ||
      pageState.isLoading ||
      filteredCountState.isLoading ||
      totalCountState.isLoading,
    pageQuery,
    pageTable: pageState.pageTable,
    pagination,
    reset: () => selection.reset(),
    selection,
    setPagination,
    setSorting,
    sorting,
    sql: baseQuery.toString(),
    tableError:
      schemaError ??
      pageState.error ??
      filteredCountState.error ??
      totalCountState.error ??
      Object.values(summaries).find((summary) => summary.error)?.error,
    totalRowCount: totalCountState.count,
  };
}
