import * as arrow from 'apache-arrow';
import {FC, useState} from 'react';
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
  const adt = useArrowDataTable(table);
  const [pagination, setPagination] = useState<PaginationState | undefined>(
    // If the table has less than pageSize rows, don't show pagination.
    table?.numRows && table.numRows <= pageSize
      ? undefined
      : {pageIndex: 0, pageSize},
  );
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
