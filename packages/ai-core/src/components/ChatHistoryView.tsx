import {Button, cn} from '@sqlrooms/ui';
import {ArrowLeft, PlusIcon} from 'lucide-react';
import {FC, useCallback, useMemo, useState} from 'react';
import {useStoreWithAi} from '../AiSlice';
import {DeleteSessionDialog, RenameSessionDialog} from './session';
import {ChatHistoryItem} from './ChatHistoryItem';
import {AnalysisSessionSchema} from '@sqlrooms/ai-config';

type ChatHistoryViewProps = {
  onBack: () => void;
  onSelectChat: (sessionId: string) => void;
  className?: string;
};

export const ChatHistoryView: FC<ChatHistoryViewProps> = ({
  onBack,
  onSelectChat,
  className,
}) => {
  const sessions = useStoreWithAi((s) => s.ai.config.sessions);
  const currentSessionId = useStoreWithAi((s) => s.ai.config.currentSessionId);
  const createSession = useStoreWithAi((s) => s.ai.createSession);
  const renameSession = useStoreWithAi((s) => s.ai.renameSession);
  const deleteSession = useStoreWithAi((s) => s.ai.deleteSession);

  const [sessionToRename, setSessionToRename] =
    useState<AnalysisSessionSchema | null>(null);
  const [sessionToDelete, setSessionToDelete] =
    useState<AnalysisSessionSchema | null>(null);

  // Sort sessions by lastOpenedAt (most recent first)
  const sortedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => {
      const aTime = a.lastOpenedAt ?? 0;
      const bTime = b.lastOpenedAt ?? 0;
      return bTime - aTime;
    });
  }, [sessions]);

  const handleSelectChat = useCallback(
    (sessionId: string) => {
      onSelectChat(sessionId);
    },
    [onSelectChat],
  );

  const handleRenameSession = useCallback((session: AnalysisSessionSchema) => {
    setSessionToRename(session);
  }, []);

  const handleDeleteSession = useCallback(
    (session: AnalysisSessionSchema) => {
      // If no messages, delete immediately; otherwise show confirmation
      if (!session.uiMessages?.length) {
        deleteSession(session.id);
      } else {
        setSessionToDelete(session);
      }
    },
    [deleteSession],
  );

  const handleCreateAndBack = useCallback(() => {
    createSession();
    onBack();
  }, [createSession, onBack]);

  const handleCloseRenameDialog = useCallback(() => {
    setSessionToRename(null);
  }, []);

  const handleConfirmRename = useCallback(
    (newName: string) => {
      if (sessionToRename) {
        renameSession(sessionToRename.id, newName);
      }
      setSessionToRename(null);
    },
    [sessionToRename, renameSession],
  );

  const handleCloseDeleteDialog = useCallback(() => {
    setSessionToDelete(null);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (sessionToDelete) {
      deleteSession(sessionToDelete.id);
    }
    setSessionToDelete(null);
  }, [sessionToDelete, deleteSession]);

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* Header */}
      <div className="flex items-center gap-3 border-b pb-3 text-sm">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="gap-2"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="font-semibold">History</span>
      </div>

      {/* Session list */}
      {sortedSessions.length > 0 ? (
        <div className="flex flex-col gap-2">
          {sortedSessions.map((session) => (
            <ChatHistoryItem
              key={session.id}
              session={session}
              isActive={session.id === currentSessionId}
              onClick={() => handleSelectChat(session.id)}
              onRename={() => handleRenameSession(session)}
              onDelete={() => handleDeleteSession(session)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-4 py-12">
          <p className="text-muted-foreground text-sm">No chats yet</p>
          <Button
            variant="outline"
            onClick={handleCreateAndBack}
            className="gap-2"
          >
            <PlusIcon className="h-4 w-4" />
            Create your first chat
          </Button>
        </div>
      )}

      <RenameSessionDialog
        isOpen={sessionToRename !== null}
        onClose={handleCloseRenameDialog}
        initialName={sessionToRename?.name ?? ''}
        onRename={handleConfirmRename}
      />
      <DeleteSessionDialog
        isOpen={sessionToDelete !== null}
        onClose={handleCloseDeleteDialog}
        onDelete={handleConfirmDelete}
      />
    </div>
  );
};
