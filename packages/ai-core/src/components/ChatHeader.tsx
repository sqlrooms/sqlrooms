import {Button, cn} from '@sqlrooms/ui';
import {HistoryIcon, PlusIcon} from 'lucide-react';
import {useCallback, useState} from 'react';
import {useStoreWithAi} from '../AiSlice';
import {DeleteSessionDialog, RenameSessionDialog} from './session';
import {SessionActionsMenu} from './SessionActionsMenu';
import type {AnalysisSessionSchema} from '@sqlrooms/ai-config';

interface ChatHeaderProps {
  onHistoryClick: () => void;
  className?: string;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  onHistoryClick,
  className,
}) => {
  const currentSession = useStoreWithAi((s) => s.ai.getCurrentSession());
  const createSession = useStoreWithAi((s) => s.ai.createSession);
  const renameSession = useStoreWithAi((s) => s.ai.renameSession);
  const deleteSession = useStoreWithAi((s) => s.ai.deleteSession);

  const [sessionToRename, setSessionToRename] =
    useState<AnalysisSessionSchema | null>(null);
  const [sessionToDelete, setSessionToDelete] =
    useState<AnalysisSessionSchema | null>(null);

  const handleRename = useCallback(() => {
    if (currentSession) {
      setSessionToRename(currentSession);
    }
  }, [currentSession]);

  const handleDelete = useCallback(() => {
    if (currentSession) {
      // If no messages, delete immediately; otherwise show confirmation
      if (!currentSession.uiMessages?.length) {
        deleteSession(currentSession.id);
      } else {
        setSessionToDelete(currentSession);
      }
    }
  }, [currentSession, deleteSession]);

  const handleRenameConfirm = useCallback(
    (newName: string) => {
      if (sessionToRename) {
        renameSession(sessionToRename.id, newName);
      }
      setSessionToRename(null);
    },
    [sessionToRename, renameSession],
  );

  const handleDeleteConfirm = useCallback(() => {
    if (sessionToDelete) {
      deleteSession(sessionToDelete.id);
    }
    setSessionToDelete(null);
  }, [sessionToDelete, deleteSession]);

  const handleCloseRenameDialog = useCallback(() => {
    setSessionToRename(null);
  }, []);

  const handleCloseDeleteDialog = useCallback(() => {
    setSessionToDelete(null);
  }, []);

  const handleCreateSession = useCallback(() => {
    createSession();
  }, [createSession]);

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 border-b pb-3',
        className,
      )}
    >
      {/* Left section */}
      <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
        <Button
          variant="ghost"
          size="sm"
          onClick={onHistoryClick}
          className="gap-2"
        >
          <HistoryIcon className="h-3.5 w-3.5" />
          History
        </Button>
        <span className="text-muted-foreground">/</span>
        <span className="truncate font-semibold">
          {currentSession?.name || 'New Chat'}
        </span>
        {currentSession && (
          <SessionActionsMenu onRename={handleRename} onDelete={handleDelete} />
        )}
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={handleCreateSession}>
          <PlusIcon className="h-4 w-4" />
        </Button>
      </div>

      <RenameSessionDialog
        isOpen={sessionToRename !== null}
        onClose={handleCloseRenameDialog}
        initialName={sessionToRename?.name ?? ''}
        onRename={handleRenameConfirm}
      />
      <DeleteSessionDialog
        isOpen={sessionToDelete !== null}
        onClose={handleCloseDeleteDialog}
        onDelete={handleDeleteConfirm}
      />
    </div>
  );
};
