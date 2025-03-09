import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@sqlrooms/ui';
import React from 'react';

/**
 * Props for the DeleteSessionDialog component
 */
export interface DeleteSessionDialogProps {
  /** Whether the dialog is currently open */
  isOpen: boolean;

  /** Callback function to close the dialog */
  onClose: () => void;

  /** Callback function to confirm deletion */
  onDelete: () => void;
}

/**
 * Dialog component for confirming session deletion.
 * Displays a warning message and provides cancel/delete buttons.
 *
 * @example
 * ```tsx
 * <DeleteSessionDialog
 *   isOpen={true}
 *   onClose={() => console.log("Dialog closed")}
 *   onDelete={() => console.log("Session deleted")}
 * />
 * ```
 */
export const DeleteSessionDialog: React.FC<DeleteSessionDialogProps> = ({
  isOpen,
  onClose,
  onDelete,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Session</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this session? This action cannot be
            undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onDelete}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
