import type {ChatSessionSchema} from '@sqlrooms/ai';
import {
  getAiSessionIdsForArtifact,
  getArtifactIdsForAiSession,
} from '@sqlrooms/artifacts/ai';
import {
  useBaseRoomStore,
  useRoomStoreApi,
  type StoreApi,
} from '@sqlrooms/room-store';
import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@sqlrooms/ui';
import {ChevronDownIcon, FileTextIcon, MessageSquareIcon} from 'lucide-react';
import {useCallback, useMemo, useSyncExternalStore} from 'react';
import {syncSessionDocumentRunContext} from '../assistant/sessionDocumentContext';
import type {WorkspaceRoomState} from './WorkspaceRoomStore';

/** Document selector shown in the workspace topbar. */
export function WorkspaceDocumentSelector({
  roomStore,
}: {
  roomStore: StoreApi<WorkspaceRoomState> | null;
}) {
  if (!roomStore) {
    return (
      <div className="text-muted-foreground flex h-9 min-w-0 items-center gap-2 px-2 text-sm">
        <FileTextIcon className="size-4 shrink-0" aria-hidden />
        <span className="truncate">Document</span>
      </div>
    );
  }

  return <WorkspaceDocumentSelectorReady roomStore={roomStore} />;
}

function WorkspaceDocumentSelectorReady({
  roomStore,
}: {
  roomStore: StoreApi<WorkspaceRoomState>;
}) {
  const artifactsConfig = useRoomStoreValue(
    roomStore,
    (state) => state.artifacts.config,
  );
  const sessionArtifactLinks = useRoomStoreValue(
    roomStore,
    (state) => state.artifactAi.config.sessionArtifactLinks,
  );
  const currentSessionId = useRoomStoreValue(
    roomStore,
    (state) => state.ai.config.currentSessionId,
  );
  const currentDocument = artifactsConfig.currentArtifactId
    ? artifactsConfig.artifactsById[artifactsConfig.currentArtifactId]
    : undefined;
  const sessionDocuments = useMemo(() => {
    if (!currentSessionId) return currentDocument ? [currentDocument] : [];
    return getArtifactIdsForAiSession({
      sessionArtifactLinks,
      sessionId: currentSessionId,
    }).flatMap((documentId) => {
      const document = artifactsConfig.artifactsById[documentId];
      return document?.type === 'document' ? [document] : [];
    });
  }, [
    artifactsConfig.artifactsById,
    currentDocument,
    currentSessionId,
    sessionArtifactLinks,
  ]);
  const handleSelect = useCallback(
    (documentId: string) => {
      const state = roomStore.getState();
      state.artifacts.setCurrentArtifact(documentId);
      if (currentSessionId) {
        syncSessionDocumentRunContext(
          roomStore.getState(),
          currentSessionId,
          documentId,
        );
      }
    },
    [currentSessionId, roomStore],
  );

  if (!currentDocument) return null;
  if (sessionDocuments.length <= 1) {
    return <StaticSelector icon="document" label={currentDocument.title} />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-9 max-w-full min-w-0 gap-2 px-2"
          aria-label="Switch document"
        >
          <FileTextIcon className="size-4 shrink-0" aria-hidden />
          <span className="truncate">{currentDocument.title}</span>
          <ChevronDownIcon className="size-4 shrink-0" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="center"
        className="max-h-96 min-w-64 overflow-y-auto"
      >
        {sessionDocuments.map((document) => (
          <DropdownMenuItem
            key={document.id}
            className={cn(document.id === currentDocument.id && 'bg-accent')}
            onSelect={() => handleSelect(document.id)}
          >
            <FileTextIcon className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{document.title}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Chat selector shown in the assistant header. */
export function WorkspaceChatSelector() {
  const roomStore = useRoomStoreApi<WorkspaceRoomState>();
  const sessions = useBaseRoomStore<WorkspaceRoomState, ChatSessionSchema[]>(
    (state) => state.ai.config.sessions,
  );
  const currentSessionId = useBaseRoomStore<
    WorkspaceRoomState,
    string | undefined
  >((state) => state.ai.config.currentSessionId);
  const currentDocumentId = useBaseRoomStore<
    WorkspaceRoomState,
    string | undefined
  >((state) => state.artifacts.config.currentArtifactId);
  const sessionArtifactLinks = useBaseRoomStore<
    WorkspaceRoomState,
    WorkspaceRoomState['artifactAi']['config']['sessionArtifactLinks']
  >((state) => state.artifactAi.config.sessionArtifactLinks);
  const switchSession = useBaseRoomStore<
    WorkspaceRoomState,
    WorkspaceRoomState['ai']['switchSession']
  >((state) => state.ai.switchSession);
  const currentSession = sessions.find(
    (session) => session.id === currentSessionId,
  );
  const documentSessions = useMemo(() => {
    if (!currentDocumentId) return [];
    const sessionIds = new Set(
      getAiSessionIdsForArtifact({
        sessions,
        sessionArtifactLinks,
        artifactId: currentDocumentId,
      }),
    );
    return sessions.filter((session) => sessionIds.has(session.id));
  }, [currentDocumentId, sessionArtifactLinks, sessions]);

  if (!currentSession) {
    return <StaticSelector icon="chat" label="Assistant" />;
  }
  if (documentSessions.length <= 1) {
    return <StaticSelector icon="chat" label={currentSession.name} />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-9 max-w-full min-w-0 gap-2 px-2"
          aria-label="Switch chat"
        >
          <MessageSquareIcon className="size-4 shrink-0" aria-hidden />
          <span className="truncate">{currentSession.name}</span>
          <ChevronDownIcon className="size-4 shrink-0" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="max-h-96 min-w-64 overflow-y-auto"
      >
        {documentSessions.map((session) => (
          <DropdownMenuItem
            key={session.id}
            className={cn(session.id === currentSession.id && 'bg-accent')}
            onSelect={() => {
              switchSession(session.id);
              const state = roomStore.getState();
              syncSessionDocumentRunContext(
                state,
                session.id,
                state.artifacts.config.currentArtifactId,
              );
            }}
          >
            <MessageSquareIcon className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{session.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function StaticSelector({
  icon,
  label,
}: {
  icon: 'chat' | 'document';
  label: string;
}) {
  const Icon = icon === 'chat' ? MessageSquareIcon : FileTextIcon;
  return (
    <div className="flex h-9 max-w-full min-w-0 items-center gap-2 px-2 text-sm font-medium">
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
    </div>
  );
}

function useRoomStoreValue<T>(
  roomStore: StoreApi<WorkspaceRoomState>,
  selector: (state: WorkspaceRoomState) => T,
) {
  return useSyncExternalStore(
    roomStore.subscribe,
    () => selector(roomStore.getState()),
    () => selector(roomStore.getInitialState()),
  );
}
