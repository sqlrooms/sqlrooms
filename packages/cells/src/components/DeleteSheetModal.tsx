import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
} from '@sqlrooms/ui';
import React from 'react';

export type DeleteSheetModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  sheetTitle?: string;
};

export const DeleteSheetModal: React.FC<DeleteSheetModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  sheetTitle,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {sheetTitle || 'Sheet'}</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this sheet? This action cannot be
            undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
