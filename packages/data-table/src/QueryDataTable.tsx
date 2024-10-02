import {AppContext, SpinnerPane} from '@sqlrooms/components';
import {
  escapeId,
  exportToCsv,
  getColValAsNumber,
  useDuckConn,
} from '@sqlrooms/duckdb';
import {genRandomStr} from '@sqlrooms/utils';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {PaginationState, SortingState} from '@tanstack/table-core';
import {FC, Suspense, useContext, useEffect, useMemo, useState} from 'react';
import DataTablePaginated from './DataTablePaginated';
import useArrowDataTable from './useArrowDataTable';

type Props = {
  query: string;
  queryKeyComponents?: any[];
};

const QueryDataTable: FC<Props> = ({query, queryKeyComponents = []}) => {
  const {conn} = useDuckConn();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 100,
  });

  const queryKeysPrefix: string[] = useMemo(
    () => ['queryDataTable', query, ...queryKeyComponents],
    [query],
  );

  const queryClient = useQueryClient();
  useEffect(() => {
    return () => {
      queryClient.removeQueries(queryKeysPrefix);
    };
  }, [queryKeysPrefix, queryClient]);

  const countQuery = useQuery(
    [...queryKeysPrefix, 'count'],
    async () => {
      return getColValAsNumber(
        await conn.query(`SELECT COUNT(*)::int FROM (
        ${query}
        )`),
      );
    },
    {
      staleTime: Infinity, // never refetch
      suspense: false,
      retry: false,
      keepPreviousData: true,
    },
  );

  const dataQueryKey = [...queryKeysPrefix, 'data', pagination, sorting];

  const dataQuery = useQuery(
    dataQueryKey,
    async () => {
     
      return await conn.query(
        // TODO: revisit timestamps conversion https://github.com/duckdb/duckdb-wasm/issues/393
        `SELECT * FROM (
          ${query}
        ) ${
          sorting.length > 0
            ? `ORDER BY ${sorting
                .map((d) => `${escapeId(d.id)}${d.desc ? ' DESC' : ''}`)
                .join(', ')}`
            : ''
        }
        OFFSET ${pagination.pageIndex * pagination.pageSize}
        LIMIT ${pagination.pageSize}`,
      );
    },
    {
      staleTime: Infinity, // never refetch
      suspense: false,
      keepPreviousData: true,
      retry: false,
    },
  );

  const arrowTableData = useArrowDataTable(dataQuery.data);

  const exportMutation = useMutation(async () => {
    if (!query) return;
    await exportToCsv(query, `export-${genRandomStr(5)}.csv`);
  }, {});

  return (
    <DataTablePaginated
      {...arrowTableData}
      pageCount={Math.ceil((countQuery.data ?? 0) / pagination.pageSize)}
      numRows={countQuery.data}
      isFetching={dataQuery.isFetching || countQuery.isFetching}
      // error={countQuery.error ?? dataQuery.error}
      pagination={pagination}
      onPaginationChange={setPagination}
      sorting={sorting}
      onSortingChange={setSorting}
      onExport={exportMutation.mutate}
      isExporting={exportMutation.isLoading}
    />
  );
};

const QueryDataTableWithErrorBoundary: FC<Props> = (props) => {
  const {ErrorBoundary} = useContext(AppContext);
  return (
    <Suspense fallback={<SpinnerPane w={'100%'} h={'100%'} />}>
      <ErrorBoundary>
        <QueryDataTable
          {...props}
          key={props.query} // reset state when query changes
        />
      </ErrorBoundary>
    </Suspense>
  );
};

export default QueryDataTableWithErrorBoundary;
