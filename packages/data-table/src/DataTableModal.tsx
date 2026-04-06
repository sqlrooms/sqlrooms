import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  UseDisclosureReturnValue,
} from '@sqlrooms/ui';
import {FC} from 'react';
import QueryDataTable from './QueryDataTable';
import * as arrow from 'apache-arrow';
import {DataTableArrowPaginated} from './DataTableArrowPaginated';
import {ArrowDataTableValueFormatter} from './useArrowDataTable';

/**
 * A modal component for displaying a table with data from a SQL query.
 *
 * @component
 * @param props - Component props
 * @param props.title - The title of the table
 * @param props.query - The SQL query to execute and display in the table
 * @param props.tableModal - An object containing the modal's open state and close function
 *
 * @example
 * ```tsx
 * import { useState } from 'react';
 * import { DataTableModal } from '@sqlrooms/data-table';
 *
 * const MyComponent = () => {
 *   const tableModal = useDisclosure();
 *   return (
 *     <DataTableModal
 *       title="Users"
 *       query="SELECT * FROM users LIMIT 10"
 *       tableModal={tableModal}
 *     />
 *   );
 * };
 * ```
 */
export type DataTableModalProps = {
  className?: string;
  title: string | undefined;
  tableModal: Pick<UseDisclosureReturnValue, 'isOpen' | 'onClose'>;
  /** Optional custom value formatter for binary/geometry data */
  formatValue?: ArrowDataTableValueFormatter;
  /** Optional callback to open query in SQL editor tab */
  onOpenAsSqlEditorTab?: () => void;
  /** SQL query to execute and display */
  query?: string;
  /** Pre-loaded Arrow table to display */
  arrowTable?: arrow.Table;
};

const DataTableModal: FC<DataTableModalProps> = (props) => {
  const {
    className,
    title,
    tableModal,
    formatValue,
    query,
    arrowTable,
    onOpenAsSqlEditorTab,
  } = props;

  return (
    <Dialog
      open={tableModal.isOpen}
      onOpenChange={(isOpen: boolean) => !isOpen && tableModal.onClose()}
    >
      <DialogContent
        className={cn('flex h-[80vh] max-w-[75vw] flex-col', className)}
        aria-describedby="data-table-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader className="flex-row items-center justify-between space-y-0">
          <DialogTitle>{title ?? ''}</DialogTitle>
          {onOpenAsSqlEditorTab && (
            <Button variant="outline" size="sm" onClick={onOpenAsSqlEditorTab}>
              Open in SQL Editor
            </Button>
          )}
          <DialogDescription className="hidden">{title}</DialogDescription>
        </DialogHeader>
        {query && (
          <div className="border-border bg-muted/50 flex min-h-0 flex-[2] flex-col overflow-hidden rounded-md border">
            <div className="text-muted-foreground border-border shrink-0 border-b px-3 py-2 text-xs font-medium">
              SQL Query
            </div>
            <pre className="text-foreground flex-1 overflow-auto px-3 py-2 font-mono text-xs">
              {query}
            </pre>
          </div>
        )}
        <div className="bg-muted flex min-h-0 flex-[3] overflow-hidden">
          {tableModal.isOpen && (
            <>
              {query ? (
                <QueryDataTable query={query} formatValue={formatValue} />
              ) : arrowTable ? (
                <DataTableArrowPaginated
                  table={arrowTable}
                  formatValue={formatValue}
                />
              ) : (
                <div className="p-4 text-xs">No data</div>
              )}
            </>
          )}
        </div>
        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={tableModal.onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DataTableModal;
