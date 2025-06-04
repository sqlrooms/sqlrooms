import * as arrow from 'apache-arrow';
import {FC, useState} from 'react';
import DataTablePaginated from './DataTablePaginated';
import useArrowDataTable from './useArrowDataTable';
import {PaginationState} from '@tanstack/react-table';

export const DataTableArrow: FC<{
  className?: string;
  table: arrow.Table | undefined;
}> = ({className, table}) => {
  const adt = useArrowDataTable(table);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 100,
  });
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
    />
  );
};
