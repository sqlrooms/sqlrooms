import type {ChatSessionSchema} from '@sqlrooms/ai';
import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@sqlrooms/ui';
import {ChevronDownIcon, MessageSquareIcon} from 'lucide-react';
import {useCallback} from 'react';
import {useArtifactSessions} from '../../hooks/useArtifactSessions';
import {useRoomStore} from '../../roomStoreHooks';

export function CliChatSelector({
  currentSession,
}: {
  currentSession: ChatSessionSchema;
}) {
  const currentArtifactId = useRoomStore(
    (state) => state.artifacts.config.currentArtifactId,
  );
  const artifactSessions = useArtifactSessions(currentArtifactId);
  const switchSession = useRoomStore((state) => state.ai.switchSession);
  const setCollapsed = useRoomStore((state) => state.layout.setCollapsed);

  const handleSelect = useCallback(
    (sessionId: string) => {
      switchSession(sessionId);
      setCollapsed('assistant-sidebar', false);
    },
    [setCollapsed, switchSession],
  );

  if (artifactSessions.length <= 1) {
    const session = artifactSessions[0] ?? currentSession;
    return (
      <div className="flex h-9 max-w-full min-w-0 items-center gap-2 px-2 text-sm font-medium">
        <MessageSquareIcon className="h-4 w-4 shrink-0" aria-hidden />
        <span className="truncate">{session.name}</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-9 max-w-full min-w-0 gap-2 px-2"
          aria-label="Switch chat"
        >
          <MessageSquareIcon className="h-4 w-4 shrink-0" aria-hidden />
          <span className="truncate">{currentSession.name}</span>
          <ChevronDownIcon className="h-4 w-4 shrink-0" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-96 overflow-y-auto">
        {artifactSessions.map((session) => (
          <DropdownMenuItem
            key={session.id}
            className={cn(session.id === currentSession.id && 'bg-accent')}
            onSelect={() => handleSelect(session.id)}
          >
            <MessageSquareIcon className="mr-2 h-4 w-4" aria-hidden />
            <span className="truncate">{session.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
