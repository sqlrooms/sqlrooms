import {CustomFunctionCall} from '@openassistant/core';
import {DataTablePaginated} from '@sqlrooms/data-table';
import {useArrowDataTable} from '@sqlrooms/data-table';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@sqlrooms/ui';
import {Table as ArrowTable} from 'apache-arrow';
import {TableIcon} from 'lucide-react';
import {useEffect, useState} from 'react';

export function QueryResult({arrowTable}: {arrowTable: ArrowTable}) {
  const count = arrowTable.numRows;

  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 5,
  });

  const [slicedTable, setSlicedTable] = useState(
    arrowTable.slice(
      pagination.pageIndex * pagination.pageSize,
      (pagination.pageIndex + 1) * pagination.pageSize,
    ),
  );

  useEffect(() => {
    setSlicedTable(
      arrowTable.slice(
        pagination.pageIndex * pagination.pageSize,
        (pagination.pageIndex + 1) * pagination.pageSize,
      ),
    );
  }, [arrowTable, pagination]);

  const tableData = useArrowDataTable(slicedTable);

  return (
    <DataTablePaginated
      {...tableData}
      pagination={pagination}
      onPaginationChange={setPagination}
      numRows={count}
      pageCount={Math.ceil(count / pagination.pageSize)}
    />
  );
}

export function queryMessage(props: CustomFunctionCall) {
  const {arrowTable} = props.output?.data as {arrowTable: ArrowTable};
  if (!arrowTable) {
    return null;
  }
  return (
    <Accordion type="multiple" defaultValue={[]}>
      <AccordionItem value="tables">
        <AccordionTrigger className="px-0 gap-1">
          <div className="flex items-center text-muted-foreground">
            <TableIcon className="h-4 w-4" />
            <h3 className="ml-1 text-xs uppercase">Query Result</h3>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <QueryResult arrowTable={arrowTable} />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
