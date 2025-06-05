import {
  DataTablePaginated,
  DataTablePaginatedProps,
  useArrowDataTable,
} from '@sqlrooms/data-table';
import {FC} from 'react';
import {SelectQueryResult} from '../SqlEditorSlice';

export type QueryResultTableProps = {
  className?: string;
  fontSize?: DataTablePaginatedProps<any>['fontSize'];
  renderActions?: (query: string) => React.ReactNode;
  queryResult: SelectQueryResult;
};

export const QueryResultTable: FC<QueryResultTableProps> = ({
  className,
  fontSize = 'text-base',
  renderActions,
  queryResult,
}) => {
  const arrowTableData = useArrowDataTable(queryResult.data);

  return (
    <DataTablePaginated
      {...arrowTableData}
      className={className}
      fontSize={fontSize}
      numRows={0}
      isFetching={false}
      pagination={{pageIndex: 0, pageSize: 100}}
      onPaginationChange={() => {}}
      onSortingChange={() => {}}
      sorting={[]}
      actions={
        renderActions ? renderActions(queryResult.lastQueryStatement) : null
      }
    />
  );
};
