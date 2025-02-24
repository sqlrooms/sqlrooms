import {CustomFunctionCall} from '@openassistant/core';
import {DataTablePaginated} from '@sqlrooms/data-table';
import {useArrowDataTable} from '@sqlrooms/data-table';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@sqlrooms/ui';
import {Table as ArrowTable} from 'apache-arrow';
import {Expand, TableIcon} from 'lucide-react';
import {useEffect, useState} from 'react';

/**
 * A component that displays a paginated data table using Apache Arrow data.
 *
 * @component
 * @param {Object} props - The component props
 * @param {ArrowTable} props.arrowTable - The Apache Arrow table containing the data to display
 * @returns {JSX.Element} A paginated data table component
 */
function QueryResultTable({arrowTable}: {arrowTable: ArrowTable}) {
  const count = arrowTable.numRows;

  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 100,
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

/**
 * A modal component that displays a data table with a title.
 *
 * @component
 * @param {Object} props - The component props
 * @param {string} props.title - The title to display in the modal header
 * @param {ArrowTable} props.arrowTable - The Apache Arrow table containing the data to display
 * @returns {JSX.Element} A modal component containing a data table
 */
function QueryResultTableModal({
  title,
  arrowTable,
}: {
  title: string;
  arrowTable: ArrowTable;
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleClick = () => {
    setIsModalOpen(true);
  };

  const onClose = () => {
    setIsModalOpen(false);
  };

  return (
    <>
      <div
        className="flex gap-2 flex-row items-center text-muted-foreground"
        onClick={handleClick}
      >
        <TableIcon className="h-4 w-4" />
        <h3 className="ml-1 text-xs uppercase">Query Result</h3>
        <Expand className="h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-200" />
      </div>

      <Dialog
        open={isModalOpen}
        onOpenChange={(isOpen: boolean) => !isOpen && onClose()}
      >
        <DialogContent
          className="h-[80vh] max-w-[75vw]"
          aria-describedby="data-table-modal"
        >
          <DialogHeader>
            <DialogTitle>{title ? `Table "${title}"` : ''}</DialogTitle>
            <DialogDescription className="hidden">{title}</DialogDescription>
          </DialogHeader>
          <div className="flex-1 bg-muted overflow-hidden">
            {isModalOpen && <QueryResultTable arrowTable={arrowTable} />}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

type QueryToolOutputData = {
  sqlQuery: string;
  arrowTable: ArrowTable;
};

function isQueryToolOutputData(data: unknown): data is QueryToolOutputData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'sqlQuery' in data &&
    'arrowTable' in data
  );
}
/**
 * Creates a query result message component based on a custom function call.
 *
 * @param {CustomFunctionCall} props - The custom function call properties
 * @returns {JSX.Element | null} A query result table modal component or null if no data is available
 */
export function queryMessage(props: CustomFunctionCall) {
  const data = props.output?.data;

  if (!isQueryToolOutputData(data)) {
    throw new Error('Invalid query tool output data');
  }
  if (!data.arrowTable) {
    return null;
  }
  return (
    <QueryResultTableModal title={data.sqlQuery} arrowTable={data.arrowTable} />
  );
}
