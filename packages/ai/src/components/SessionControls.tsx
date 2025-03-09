import {Button, cn} from '@sqlrooms/ui';
import React, {useState} from 'react';
import {useStoreWithAi} from '../AiSlice';
import {
  DeleteSessionDialog,
  SessionActions,
  SessionDropdown,
  SessionTitle,
} from './session';

/**
 * Main component for managing AI sessions.
 * Combines session dropdown, title editing, action buttons, and delete confirmation.
 *
 * @example
 * ```tsx
 * <SessionControls className="p-4 border-b" />
 * ```
 */
export const SessionControls: React.FC<{className?: string}> = ({
  className,
}) => {
  const sessions = useStoreWithAi((s) => s.config.ai.sessions);
  const currentSessionId = useStoreWithAi((s) => s.config.ai.currentSessionId);
  const currentSession = useStoreWithAi((s) => s.ai.getCurrentSession());
  const switchSession = useStoreWithAi((s) => s.ai.switchSession);
  const createSession = useStoreWithAi((s) => s.ai.createSession);
  const renameSession = useStoreWithAi((s) => s.ai.renameSession);
  const deleteSession = useStoreWithAi((s) => s.ai.deleteSession);

  const [sessionToDeleteId, setSessionToDeleteId] = useState<string | null>(
    null,
  );

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  /**
   * Creates a new session with a human-readable timestamp as the name
   */
  const handleCreateSession = () => {
    // Generate a human-readable date and time for the session name
    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const formattedTime = now.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: 'numeric',
      hour12: true,
    });
    const sessionName = `Session ${formattedDate} at ${formattedTime}`;
    createSession(sessionName);
  };

  /**
   * Opens the delete confirmation dialog for a specific session
   */
  const handleOpenDeleteDialog = (sessionId: string) => {
    setSessionToDeleteId(sessionId);
    setIsDeleteDialogOpen(true);
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

  return (
    <>
      {/* Header with session controls */}
      <div
        className={cn('flex flex-wrap items-center justify-between', className)}
      >
        {/* Left side - History Button and Editable Session Title */}
        <div className="flex items-center gap-3">
          <SessionDropdown
            sessions={sessions}
            currentSessionId={currentSessionId}
            onCreateSession={handleCreateSession}
            onSwitchSession={switchSession}
          />

          <SessionTitle
            currentSession={currentSession}
            onRenameSession={renameSession}
          />
        </div>

        {/* Right side buttons */}
        <SessionActions
          sessions={sessions}
          currentSessionId={currentSessionId}
          onCreateSession={handleCreateSession}
          onOpenDeleteDialog={handleOpenDeleteDialog}
        />
      </div>

      {/* Delete Confirmation Dialog */}
      <DeleteSessionDialog
        isOpen={isDeleteDialogOpen}
        onClose={handleCloseDeleteDialog}
        onDelete={handleDeleteSession}
      />
    </>
  );
};
