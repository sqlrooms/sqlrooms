import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@sqlrooms/ui';
import {FC} from 'react';
import QueryDataTable from './QueryDataTable';

type Props = {
  title: string | undefined;
  query: string | undefined;
  tableModal: {
    isOpen: boolean;
    onClose: () => void;
  };
};

const DataTableModal: FC<Props> = ({title, query, tableModal}) => {
  return (
    <Dialog
      open={tableModal.isOpen}
      onOpenChange={(isOpen: boolean) => !isOpen && tableModal.onClose()}
    >
      <DialogContent className="h-[80vh] max-w-[75vw]">
        <DialogHeader>
          <DialogTitle>{title ? `Table "${title}"` : ''}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 bg-muted overflow-hidden">
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
