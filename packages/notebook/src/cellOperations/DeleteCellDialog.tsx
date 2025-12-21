import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@sqlrooms/ui';
import {Trash2Icon} from 'lucide-react';
import {FC, useState} from 'react';

import {NotebookCell} from '../cellSchemas';
import {useStoreWithNotebook} from '../useStoreWithNotebook';

type Props = {
  cell: NotebookCell;
};

export const DeleteCellDialog: FC<Props> = ({cell}) => {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const onRemove = useStoreWithNotebook((s) => s.notebook.removeCell);

  return (
    <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="h-6 w-6" size="xs">
          <Trash2Icon
            size={16}
            strokeWidth={1.5}
            className="cursor-pointer text-gray-500"
          />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Delete</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this {(cell.data as any).title}?
            <br /> This operation can not be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setConfirmOpen(false)}
            className="text-primary"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="destructive"
            onClick={() => onRemove(cell.id)}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
