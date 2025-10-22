import * as arrow from 'apache-arrow';
import {FC, useMemo, useState} from 'react';
import DataTablePaginated, {
  DataTablePaginatedProps,
} from './DataTablePaginated';
import useArrowDataTable from './useArrowDataTable';
import {PaginationState} from '@tanstack/react-table';

export const DataTableArrowPaginated: FC<{
  className?: string;
  table: arrow.Table | undefined;
  fontSize?: DataTablePaginatedProps<any>['fontSize'];
  footerActions?: DataTablePaginatedProps<any>['footerActions'];
  pageSize?: number;
}> = ({className, table, fontSize, footerActions, pageSize = 100}) => {
  const [pagination, setPagination] = useState<PaginationState | undefined>(
    // If the table has less than pageSize rows, don't show pagination.
    table?.numRows && table.numRows <= pageSize
      ? undefined
      : {pageIndex: 0, pageSize},
  );
  const pageData = useMemo(() => {
    if (!table || !pagination) return table;
    const startIndex = pagination.pageIndex * pagination.pageSize;
    const endIndex = startIndex + pagination.pageSize;
    return table.slice(startIndex, endIndex);
  }, [table, pagination]);

  const adt = useArrowDataTable(pageData);
  if (!adt) {
    return <div className="p-4 text-xs">No data</div>;
  }
  return (
    <DataTablePaginated
      className={className}
      data={adt.data}
      columns={adt.columns}
      numRows={table?.numRows}
      pagination={pagination}
      onPaginationChange={setPagination}
      fontSize={fontSize}
      footerActions={footerActions}
    />
  );
};
