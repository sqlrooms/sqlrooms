import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
} from '@sqlrooms/ui';
import {FC} from 'react';

export type ConfirmDatasetChangeDialogProps = {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export const ConfirmDatasetChangeDialog: FC<
  ConfirmDatasetChangeDialogProps
> = ({open, onConfirm, onCancel}) => {
  return (
    <Dialog open={open} onOpenChange={onCancel}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Change dataset?</DialogTitle>
          <DialogDescription>
            Changing the dataset will affect all panels in this dashboard. Are
            you sure you want to continue?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onConfirm}>Change dataset</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
