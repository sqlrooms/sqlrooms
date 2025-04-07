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
const DataTableModal: FC<{
  className?: string;
  title: string | undefined;
  query: string | undefined;
  tableModal: Pick<UseDisclosureReturnValue, 'isOpen' | 'onClose'>;
}> = ({className, title, query, tableModal}) => {
  return (
    <Dialog
      open={tableModal.isOpen}
      onOpenChange={(isOpen: boolean) => !isOpen && tableModal.onClose()}
    >
      <DialogContent
        className={cn('h-[80vh] max-w-[75vw]', className)}
        aria-describedby="data-table-modal"
      >
        <DialogHeader>
          <DialogTitle>{title ? `Table "${title}"` : ''}</DialogTitle>
          <DialogDescription className="hidden">{title}</DialogDescription>
        </DialogHeader>
        <div className="bg-muted flex-1 overflow-hidden">
          {tableModal.isOpen && query ? <QueryDataTable query={query} /> : null}
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
