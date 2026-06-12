import {
  Button,
  cn,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@sqlrooms/ui';
import {HistoryIcon, LoaderCircleIcon, PlusIcon} from 'lucide-react';
import {useCallback, useState} from 'react';
import {useStoreWithAi} from '../AiSlice';
import {DeleteSessionDialog, RenameSessionDialog} from './session';
import {SessionActionsMenu} from './SessionActionsMenu';
import type {AnalysisSessionSchema} from '@sqlrooms/ai-config';

interface ChatHeaderProps {
  onHistoryClick: () => void;
  onCreateSession?: () => void;
  historyIsRunning?: boolean;
  className?: string;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  onHistoryClick,
  onCreateSession,
  historyIsRunning = false,
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
    if (onCreateSession) {
      onCreateSession();
      return;
    }
    createSession();
  }, [createSession, onCreateSession]);

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 border-b pb-3',
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
        <Button
          variant="ghost"
          size="sm"
          onClick={onHistoryClick}
          className="gap-2"
        >
          <HistoryIcon className="h-3.5 w-3.5" />
          {historyIsRunning ? (
            <LoaderCircleIcon className="text-primary h-3 w-3 animate-spin" />
          ) : null}
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

      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCreateSession}
              aria-label="New session"
            >
              <PlusIcon className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>New session</TooltipContent>
        </Tooltip>
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
