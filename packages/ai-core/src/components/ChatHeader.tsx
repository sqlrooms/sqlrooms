import {
  Button,
  cn,
  EditableText,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@sqlrooms/ui';
import {HistoryIcon, LoaderCircleIcon, PlusIcon} from 'lucide-react';
import {useCallback, useState} from 'react';
import {useStoreWithAi} from '../AiSlice';
import {DeleteSessionDialog} from './session';
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

  const [sessionToDelete, setSessionToDelete] =
    useState<AnalysisSessionSchema | null>(null);

  const handleDelete = useCallback(() => {
    if (currentSession) {
      if (!currentSession.uiMessages?.length) {
        deleteSession(currentSession.id);
      } else {
        setSessionToDelete(currentSession);
      }
    }
  }, [currentSession, deleteSession]);

  const handleRename = useCallback(
    (newName: string) => {
      const trimmedName = newName.trim();
      if (
        currentSession &&
        trimmedName &&
        trimmedName !== currentSession.name
      ) {
        renameSession(currentSession.id, trimmedName);
      }
    },
    [currentSession, renameSession],
  );

  const handleDeleteConfirm = useCallback(() => {
    if (sessionToDelete) {
      deleteSession(sessionToDelete.id);
    }
    setSessionToDelete(null);
  }, [sessionToDelete, deleteSession]);

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
      <div className="flex min-w-0 flex-1 items-center gap-1.5 text-sm">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onHistoryClick}
              className="relative h-8 w-8 shrink-0"
              aria-label="Chat history"
            >
              <HistoryIcon className="h-4 w-4" />
              {historyIsRunning ? (
                <LoaderCircleIcon className="text-primary absolute top-1 right-1 h-2.5 w-2.5 animate-spin" />
              ) : null}
            </Button>
          </TooltipTrigger>
          <TooltipContent>History</TooltipContent>
        </Tooltip>
        <EditableText
          value={currentSession?.name || 'New Chat'}
          onChange={handleRename}
          placeholder="New Chat"
          selectOnFocus
          isReadOnly={!currentSession}
          className="text-foreground hover:bg-accent h-8 max-w-full min-w-0 border-transparent text-sm leading-none font-semibold shadow-none ring-0 focus-visible:ring-1"
        />
        {currentSession && <SessionActionsMenu onDelete={handleDelete} />}
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

      <DeleteSessionDialog
        isOpen={sessionToDelete !== null}
        onClose={handleCloseDeleteDialog}
        onDelete={handleDeleteConfirm}
      />
    </div>
  );
};
