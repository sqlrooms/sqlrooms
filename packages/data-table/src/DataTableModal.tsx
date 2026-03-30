import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Textarea,
  UseDisclosureReturnValue,
} from '@sqlrooms/ui';
import {FC} from 'react';
import QueryDataTable from './QueryDataTable';
import * as arrow from 'apache-arrow';
import {DataTableArrowPaginated} from './DataTableArrowPaginated';
import {ArrowDataTableValueFormatter} from './useArrowDataTable';
import {SquareTerminal} from 'lucide-react';

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
  /** Optional callback to create a new SQL tab with the query */
  onCreateSqlTab?: (query: string) => void;
} & (
  | {
      query: string | undefined;
      arrowTable?: never;
    }
  | {
      arrowTable: arrow.Table | undefined;
      query?: never;
    }
);

const DataTableModal: FC<DataTableModalProps> = (props) => {
  const {className, title, tableModal, formatValue, onCreateSqlTab} = props;
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
        <DialogHeader>
          <DialogTitle>{title ?? ''}</DialogTitle>
          <DialogDescription className="hidden">{title}</DialogDescription>
        </DialogHeader>
        {'query' in props && props.query && (
          <div className="flex min-h-0 flex-col gap-2 px-1">
            <div className="flex items-center justify-between">
              <div className="text-muted-foreground text-xs font-medium">
                Query
              </div>
              {onCreateSqlTab && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1"
                  onClick={() => {
                    onCreateSqlTab(props.query!);
                    tableModal.onClose();
                  }}
                >
                  <SquareTerminal className="h-3 w-3" />
                  <span className="text-xs">Open in SQL Editor</span>
                </Button>
              )}
            </div>
            <Textarea
              value={props.query}
              readOnly
              className="bg-muted max-h-[200px] min-h-[120px] resize-none font-mono text-xs"
            />
          </div>
        )}
        <div className="bg-muted min-h-0 flex-1 overflow-hidden">
          {tableModal.isOpen && (
            <>
              {'query' in props && props.query ? (
                <QueryDataTable query={props.query} formatValue={formatValue} />
              ) : 'arrowTable' in props && props.arrowTable ? (
                <DataTableArrowPaginated
                  table={props.arrowTable}
                  formatValue={formatValue}
                />
              ) : (
                <div className="p-4 text-xs">No data</div>
              )}
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={tableModal.onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DataTableModal;
