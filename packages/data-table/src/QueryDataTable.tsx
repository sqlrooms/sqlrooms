import {SpinnerPane} from '@sqlrooms/ui';
import {
  escapeId,
  exportToCsv,
  getColValAsNumber,
  useDuckDb,
} from '@sqlrooms/duckdb';
import {genRandomStr} from '@sqlrooms/utils';
import {PaginationState, SortingState} from '@tanstack/table-core';
import {FC, Suspense, useEffect, useState} from 'react';
import DataTablePaginated from './DataTablePaginated';
import useArrowDataTable from './useArrowDataTable';

type Props = {
  query: string;
  queryKeyComponents?: any[];
};

const QueryDataTable: FC<Props> = ({query}) => {
  const {conn} = useDuckDb();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 100,
  });

  const [count, setCount] = useState<number | undefined>(undefined);
  const [data, setData] = useState<any>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Fetch row count
  useEffect(() => {
    const fetchCount = async () => {
      try {
        setIsFetching(true);
        const result = await conn.query(`SELECT COUNT(*)::int FROM (${query})`);
        setCount(getColValAsNumber(result));
      } catch (error) {
        console.error('Error fetching count:', error);
      } finally {
        setIsFetching(false);
      }
    };

    fetchCount();
  }, [query, conn]);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsFetching(true);
        const result = await conn.query(
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
        setData(result);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsFetching(false);
      }
    };

    fetchData();
  }, [query, pagination, sorting, conn]);

  const arrowTableData = useArrowDataTable(data);

  const handleExport = async () => {
    if (!query) return;
    try {
      setIsExporting(true);
      await exportToCsv(query, `export-${genRandomStr(5)}.csv`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DataTablePaginated
      {...arrowTableData}
      pageCount={Math.ceil((count ?? 0) / pagination.pageSize)}
      numRows={count}
      isFetching={isFetching}
      pagination={pagination}
      onPaginationChange={setPagination}
      sorting={sorting}
      onSortingChange={setSorting}
      onExport={handleExport}
      isExporting={isExporting}
    />
  );
};

const QueryDataTableWithSuspense: FC<Props> = (props) => {
  return (
    <Suspense fallback={<SpinnerPane className="w-full h-full" />}>
      <QueryDataTable
        {...props}
        key={props.query} // reset state when query changes
      />
    </Suspense>
  );
};

export default QueryDataTableWithSuspense;
