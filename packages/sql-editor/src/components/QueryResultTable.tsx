import {
  DataTablePaginated,
  DataTablePaginatedProps,
  useArrowDataTable,
} from '@sqlrooms/data-table';
import {FC} from 'react';
import {SelectQueryResult, useStoreWithSqlEditor} from '../SqlEditorSlice';

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
  // const queryResult = useSql({query: pagedQuery});
  // const countQueryResult = useSql<{count: number}>({
  //   query: `SELECT COUNT(*)::int AS count FROM (${query})`,
  // });

  const arrowTableData = useArrowDataTable(queryResult.pageData);

  return (
    <DataTablePaginated
      {...arrowTableData}
      className={className}
      fontSize={fontSize}
      numRows={queryResult.numRows}
      isFetching={queryResult.isPageLoading}
      pagination={queryResult.pagination}
      onPaginationChange={() => {}}
      sorting={queryResult.sorting}
      onSortingChange={() => {}}
      actions={
        renderActions ? renderActions(queryResult.lastQueryStatement) : null
      }
    />
  );
};
