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
  const {className, title, tableModal, formatValue} = props;
  return (
    <Dialog
      open={tableModal.isOpen}
      onOpenChange={(isOpen: boolean) => !isOpen && tableModal.onClose()}
    >
      <DialogContent
        className={cn('h-[80vh] max-w-[75vw]', className)}
        aria-describedby="data-table-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle>{title ?? ''}</DialogTitle>
          <DialogDescription className="hidden">{title}</DialogDescription>
        </DialogHeader>
        <div className="bg-muted flex-1 overflow-hidden">
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
