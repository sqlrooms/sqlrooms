import {Button, cn} from '@sqlrooms/ui';
import {ArrowLeft, PencilIcon, PlusIcon, TrashIcon} from 'lucide-react';
import {useMemo, useState} from 'react';
import {formatTimeRelative} from '@sqlrooms/utils';
import {useStoreWithAi} from '../AiSlice';
import {DeleteSessionDialog, RenameSessionDialog} from './session';
import type {AnalysisSessionSchema} from '@sqlrooms/ai-config';

interface ChatHistoryViewProps {
  onBack: () => void;
  onSelectChat: (sessionId: string) => void;
  className?: string;
}

interface SessionListItemProps {
  session: AnalysisSessionSchema;
  isActive: boolean;
  onClick: () => void;
  onRename: () => void;
  onDelete: () => void;
}

const SessionListItem: React.FC<SessionListItemProps> = ({
  session,
  isActive,
  onClick,
  onRename,
  onDelete,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const messageCount = session.uiMessages?.length ?? 0;
  const lastMessage = session.uiMessages?.[session.uiMessages.length - 1];

  // Extract text from message parts
  const preview =
    lastMessage?.parts
      ?.filter(
        (part): part is {type: 'text'; text: string} => part.type === 'text',
      )
      .map((part) => part.text)
      .join(' ') ?? '';

  const relativeTime = session.lastOpenedAt
    ? formatTimeRelative(session.lastOpenedAt)
    : '';

  return (
    <div
      className={cn(
        'group relative cursor-pointer rounded-md border p-3 transition-colors',
        isActive
          ? 'border-l-primary bg-primary/5 border-l-4'
          : 'border-border hover:bg-muted',
      )}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 text-sm font-medium">{session.name}</div>
          <div className="text-muted-foreground mb-2 text-xs">
            {messageCount} {messageCount === 1 ? 'message' : 'messages'}
            {relativeTime && ` · ${relativeTime}`}
          </div>
          {preview && (
            <div className="text-muted-foreground truncate text-xs">
              {preview}
            </div>
          )}
        </div>

        {/* Action buttons - visible on hover */}
        <div
          className={cn(
            'flex gap-1 transition-opacity',
            isHovered ? 'opacity-100' : 'opacity-0',
          )}
        >
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={(e) => {
              e.stopPropagation();
              onRename();
            }}
          >
            <PencilIcon className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive h-8 w-8 p-0"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <TrashIcon className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export const ChatHistoryView: React.FC<ChatHistoryViewProps> = ({
  onBack,
  onSelectChat,
  className,
}) => {
  const sessions = useStoreWithAi((s) => s.ai.config.sessions);
  const currentSessionId = useStoreWithAi((s) => s.ai.config.currentSessionId);
  const createSession = useStoreWithAi((s) => s.ai.createSession);
  const renameSession = useStoreWithAi((s) => s.ai.renameSession);
  const deleteSession = useStoreWithAi((s) => s.ai.deleteSession);

  const [sessionToRename, setSessionToRename] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);

  // Sort sessions by lastOpenedAt (most recent first)
  const sortedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => {
      const aTime = a.lastOpenedAt ?? 0;
      const bTime = b.lastOpenedAt ?? 0;
      return bTime - aTime;
    });
  }, [sessions]);

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* Header */}
      <div className="flex items-center gap-3 border-b pb-3 text-sm">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="font-semibold">History</span>
      </div>

      {/* Session list */}
      {sortedSessions.length > 0 ? (
        <div className="flex flex-col gap-2">
          {sortedSessions.map((session) => (
            <SessionListItem
              key={session.id}
              session={session}
              isActive={session.id === currentSessionId}
              onClick={() => onSelectChat(session.id)}
              onRename={() =>
                setSessionToRename({id: session.id, name: session.name})
              }
              onDelete={() => {
                // If no messages, delete immediately; otherwise show confirmation
                if (!session.uiMessages?.length) {
                  deleteSession(session.id);
                } else {
                  setSessionToDelete(session.id);
                }
              }}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-4 py-12">
          <p className="text-muted-foreground text-sm">No chats yet</p>
          <Button
            variant="outline"
            onClick={() => {
              createSession();
              onBack();
            }}
            className="gap-2"
          >
            <PlusIcon className="h-4 w-4" />
            Create your first chat
          </Button>
        </div>
      )}

      <RenameSessionDialog
        isOpen={sessionToRename !== null}
        onClose={() => setSessionToRename(null)}
        initialName={sessionToRename?.name ?? ''}
        onRename={(newName) => {
          if (sessionToRename) {
            renameSession(sessionToRename.id, newName);
          }
          setSessionToRename(null);
        }}
      />
      <DeleteSessionDialog
        isOpen={sessionToDelete !== null}
        onClose={() => setSessionToDelete(null)}
        onDelete={() => {
          if (sessionToDelete) {
            deleteSession(sessionToDelete);
          }
          setSessionToDelete(null);
        }}
      />
    </div>
  );
};
