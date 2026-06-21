import {Button, cn} from '@sqlrooms/ui';
import {Trash2} from 'lucide-react';
import React, {useState} from 'react';
import {useStoreWithAi} from '../../AiSlice';
import {DeleteSessionDialog} from './DeleteSessionDialog';

/**
 * Props for the DeleteSessionButton component
 */
export interface DeleteSessionButtonProps {
  /** Optional CSS class names to apply to the button */
  className?: string;
}

/**
 * A button component that handles session deletion with confirmation dialog.
 *
 * @example
 * ```tsx
 * <DeleteSessionButton className="my-custom-class" />
 * ```
 */
export const DeleteSessionButton: React.FC<DeleteSessionButtonProps> = ({
  className,
}) => {
  const currentSessionId = useStoreWithAi((s) => s.ai.getCurrentSession()?.id);
  const deleteSession = useStoreWithAi((s) => s.ai.deleteSession);

  const [sessionToDeleteId, setSessionToDeleteId] = useState<string | null>(
    null,
  );
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  /**
   * Opens the delete confirmation dialog for the current session
   */
  const handleOpenDeleteDialog = () => {
    if (currentSessionId) {
      setSessionToDeleteId(currentSessionId);
      setIsDeleteDialogOpen(true);
    }
  };

  /**
   * Deletes the session after confirmation
   */
  const handleDeleteSession = () => {
    if (sessionToDeleteId) {
      deleteSession(sessionToDeleteId);
      setIsDeleteDialogOpen(false);
      setSessionToDeleteId(null);
    }
  };

  /**
   * Closes the delete confirmation dialog without deleting
   */
  const handleCloseDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
    setSessionToDeleteId(null);
  };

  if (!currentSessionId) {
    return null;
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className={cn('text-destructive', className)}
        onClick={handleOpenDeleteDialog}
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      {/* Delete Confirmation Dialog */}
      <DeleteSessionDialog
        isOpen={isDeleteDialogOpen}
        onClose={handleCloseDeleteDialog}
        onDelete={handleDeleteSession}
      />
    </>
  );
};
