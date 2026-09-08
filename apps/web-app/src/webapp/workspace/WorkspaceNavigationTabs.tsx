import type {ChatSessionSchema} from '@sqlrooms/ai';
import type {StoreApi} from '@sqlrooms/room-store';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  ScrollArea,
  SidebarMenu,
  SidebarMenuItem,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useSidebar,
} from '@sqlrooms/ui';
import {
  EllipsisVerticalIcon,
  FileTextIcon,
  LoaderCircleIcon,
  MessageSquareIcon,
  MessageSquarePlusIcon,
  PencilIcon,
  PinIcon,
  PinOffIcon,
  PlusIcon,
  Trash2Icon,
} from 'lucide-react';
import {useCallback, useMemo, useState, useSyncExternalStore} from 'react';
import {syncSessionDocumentRunContext} from '../assistant/sessionDocumentContext';
import {
  DeleteNavigationItemDialog,
  RenameNavigationItemDialog,
  type NavigationItem,
} from './WorkspaceNavigationDialogs';
import {setWorkspaceAssistantPanelOpen} from './WorkspaceLayoutSurface';
import type {WorkspaceRoomState} from './WorkspaceRoomStore';

/** CLI-style Chats/Documents navigation for the workspace sidebar. */
export function WorkspaceNavigationTabs({
  roomStore,
  onCreateDocument,
}: {
  roomStore: StoreApi<WorkspaceRoomState> | null;
  onCreateDocument: (() => void) | undefined;
}) {
  const {state: sidebarState} = useSidebar();
  const [activeTab, setActiveTab] = useState<'chats' | 'documents'>('chats');

  if (sidebarState !== 'expanded' || !roomStore) return null;

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => setActiveTab(value as 'chats' | 'documents')}
      className="flex min-h-44 min-w-0 flex-1 flex-col"
    >
      <div className="mb-1 shrink-0 px-2">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="chats">Chats</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="chats" className="mt-0 min-h-0 flex-1">
        <WorkspaceChatsList roomStore={roomStore} />
      </TabsContent>
      <TabsContent value="documents" className="mt-0 min-h-0 flex-1">
        <WorkspaceDocumentsList
          roomStore={roomStore}
          onCreateDocument={onCreateDocument}
        />
      </TabsContent>
    </Tabs>
  );
}

function WorkspaceChatsList({
  roomStore,
}: {
  roomStore: StoreApi<WorkspaceRoomState>;
}) {
  const aiConfig = useRoomStoreValue(roomStore, (state) => state.ai.config);
  const currentDocumentId = useRoomStoreValue(
    roomStore,
    (state) => state.artifacts.config.currentArtifactId,
  );
  const sortedSessions = useMemo(
    () => sortSessions(aiConfig.sessions, aiConfig.pinnedSessionIds),
    [aiConfig.pinnedSessionIds, aiConfig.sessions],
  );
  const currentSession = aiConfig.sessions.find(
    (session) => session.id === aiConfig.currentSessionId,
  );
  const [sessionToRename, setSessionToRename] = useState<NavigationItem | null>(
    null,
  );
  const [sessionToDelete, setSessionToDelete] = useState<NavigationItem | null>(
    null,
  );

  const createChat = useCallback(() => {
    const state = roomStore.getState();
    if (!state.artifacts.config.currentArtifactId) return;
    const sessionId = state.artifactAi.createArtifactScopedSession('New chat');
    if (!sessionId) return;
    syncSessionDocumentRunContext(
      roomStore.getState(),
      sessionId,
      state.artifacts.config.currentArtifactId,
    );
    setWorkspaceAssistantPanelOpen(roomStore, true);
  }, [roomStore]);

  return (
    <>
      <SidebarCollection
        actionLabel="New Chat"
        actionDisabled={
          !currentDocumentId || Boolean(currentSession?.isRunning)
        }
        onAction={createChat}
        emptyLabel="No chats yet. Create one to start."
      >
        {sortedSessions.map((session) => {
          const isPinned =
            aiConfig.pinnedSessionIds?.includes(session.id) ?? false;
          return (
            <SidebarMenuItem key={session.id} className="group/item min-w-0">
              <button
                type="button"
                onClick={() => {
                  roomStore.getState().ai.switchSession(session.id);
                  const state = roomStore.getState();
                  syncSessionDocumentRunContext(
                    state,
                    session.id,
                    state.artifacts.config.currentArtifactId,
                  );
                  setWorkspaceAssistantPanelOpen(roomStore, true);
                }}
                className={`hover:bg-sidebar-accent flex h-8 w-full min-w-0 items-center gap-2 rounded-md pr-8 pl-2 text-left text-sm transition-colors ${
                  session.id === aiConfig.currentSessionId
                    ? 'bg-primary/15 text-primary'
                    : ''
                }`}
                title={session.name}
              >
                {session.isRunning ? (
                  <LoaderCircleIcon className="text-primary size-4 shrink-0 animate-spin" />
                ) : (
                  <MessageSquareIcon className="size-4 shrink-0" aria-hidden />
                )}
                <span className="min-w-0 flex-1 truncate">{session.name}</span>
                {isPinned ? (
                  <PinIcon className="size-3.5 shrink-0 opacity-60 group-hover/item:opacity-0" />
                ) : null}
              </button>
              <ItemActions
                label={session.name}
                isPinned={isPinned}
                onTogglePin={() =>
                  roomStore.getState().ai.togglePinSession(session.id)
                }
                onRename={() =>
                  setSessionToRename({id: session.id, name: session.name})
                }
                onDelete={() =>
                  setSessionToDelete({id: session.id, name: session.name})
                }
              />
            </SidebarMenuItem>
          );
        })}
      </SidebarCollection>
      <RenameNavigationItemDialog
        item={sessionToRename}
        itemType="chat"
        onOpenChange={(open) => {
          if (!open) setSessionToRename(null);
        }}
        onRename={(sessionId, name) => {
          roomStore.getState().ai.renameSession(sessionId, name);
          setSessionToRename(null);
        }}
      />
      <DeleteNavigationItemDialog
        item={sessionToDelete}
        itemType="chat"
        onOpenChange={(open) => {
          if (!open) setSessionToDelete(null);
        }}
        onConfirm={() => {
          if (sessionToDelete) {
            roomStore.getState().ai.deleteSession(sessionToDelete.id);
          }
          setSessionToDelete(null);
        }}
      />
    </>
  );
}

function WorkspaceDocumentsList({
  roomStore,
  onCreateDocument,
}: {
  roomStore: StoreApi<WorkspaceRoomState>;
  onCreateDocument: (() => void) | undefined;
}) {
  const artifactsConfig = useRoomStoreValue(
    roomStore,
    (state) => state.artifacts.config,
  );
  const documents = useMemo(() => {
    const pinnedIds = new Set(artifactsConfig.pinnedArtifactIds);
    return artifactsConfig.artifactOrder
      .map((documentId) => artifactsConfig.artifactsById[documentId])
      .filter((document) => document?.type === 'document')
      .sort(
        (left, right) =>
          Number(pinnedIds.has(right.id)) - Number(pinnedIds.has(left.id)),
      );
  }, [artifactsConfig]);
  const [documentToRename, setDocumentToRename] =
    useState<NavigationItem | null>(null);
  const [documentToDelete, setDocumentToDelete] =
    useState<NavigationItem | null>(null);

  return (
    <>
      <SidebarCollection
        actionLabel="New"
        actionDisabled={!onCreateDocument}
        onAction={() => onCreateDocument?.()}
        emptyLabel="No documents yet. Create one to start."
      >
        {documents.map((document) => {
          const isPinned = artifactsConfig.pinnedArtifactIds.includes(
            document.id,
          );
          return (
            <SidebarMenuItem key={document.id} className="group/item min-w-0">
              <button
                type="button"
                onClick={() => {
                  roomStore
                    .getState()
                    .artifacts.setCurrentArtifact(document.id);
                  const state = roomStore.getState();
                  if (state.ai.config.currentSessionId) {
                    syncSessionDocumentRunContext(
                      state,
                      state.ai.config.currentSessionId,
                      document.id,
                    );
                  }
                }}
                className={`hover:bg-sidebar-accent flex h-8 w-full min-w-0 items-center gap-2 rounded-md pr-8 pl-2 text-left text-sm transition-colors ${
                  document.id === artifactsConfig.currentArtifactId
                    ? 'bg-primary/15 text-primary'
                    : ''
                }`}
                title={document.title}
              >
                <FileTextIcon className="size-4 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1 truncate">
                  {document.title}
                </span>
                {isPinned ? (
                  <PinIcon className="size-3.5 shrink-0 opacity-60 group-hover/item:opacity-0" />
                ) : null}
              </button>
              <ItemActions
                label={document.title}
                isPinned={isPinned}
                onNewChat={() => {
                  const state = roomStore.getState();
                  state.artifacts.setCurrentArtifact(document.id);
                  const sessionId =
                    state.artifactAi.createArtifactScopedSession('New chat');
                  if (sessionId) {
                    syncSessionDocumentRunContext(
                      roomStore.getState(),
                      sessionId,
                      document.id,
                    );
                    setWorkspaceAssistantPanelOpen(roomStore, true);
                  }
                }}
                onTogglePin={() =>
                  roomStore.getState().artifacts.togglePinArtifact(document.id)
                }
                onRename={() =>
                  setDocumentToRename({id: document.id, name: document.title})
                }
                onDelete={() =>
                  setDocumentToDelete({id: document.id, name: document.title})
                }
              />
            </SidebarMenuItem>
          );
        })}
      </SidebarCollection>
      <RenameNavigationItemDialog
        item={documentToRename}
        itemType="document"
        onOpenChange={(open) => {
          if (!open) setDocumentToRename(null);
        }}
        onRename={(documentId, title) => {
          roomStore.getState().artifacts.renameArtifact(documentId, title);
          setDocumentToRename(null);
        }}
      />
      <DeleteNavigationItemDialog
        item={documentToDelete}
        itemType="document"
        onOpenChange={(open) => {
          if (!open) setDocumentToDelete(null);
        }}
        onConfirm={() => {
          if (documentToDelete) {
            roomStore.getState().artifacts.deleteArtifact(documentToDelete.id);
          }
          setDocumentToDelete(null);
        }}
      />
    </>
  );
}

function SidebarCollection({
  actionLabel,
  actionDisabled,
  onAction,
  emptyLabel,
  children,
}: {
  actionLabel: string;
  actionDisabled: boolean;
  onAction: () => void;
  emptyLabel: string;
  children: React.ReactNode;
}) {
  const hasChildren = Array.isArray(children)
    ? children.length > 0
    : Boolean(children);
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <div className="mb-1 flex h-7 shrink-0 items-center justify-end px-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-primary hover:bg-primary/10 hover:text-primary h-6 gap-1 px-2 text-sm"
          onClick={onAction}
          disabled={actionDisabled}
        >
          <PlusIcon className="size-3.5" aria-hidden />
          {actionLabel}
        </Button>
      </div>
      <ScrollArea className="min-h-0 min-w-0 flex-1 overflow-hidden">
        <div className="w-full max-w-full min-w-0 py-0.5 pr-2 pl-0.5">
          <SidebarMenu className="max-w-full min-w-0 gap-0.5">
            {hasChildren ? (
              children
            ) : (
              <div className="text-muted-foreground px-2 py-8 text-center text-sm">
                {emptyLabel}
              </div>
            )}
          </SidebarMenu>
        </div>
      </ScrollArea>
    </div>
  );
}

function ItemActions({
  label,
  isPinned,
  onNewChat,
  onTogglePin,
  onRename,
  onDelete,
}: {
  label: string;
  isPinned: boolean;
  onNewChat?: () => void;
  onTogglePin: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute top-1 right-1 size-6 opacity-0 group-hover/item:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
          aria-label={`Actions for ${label}`}
        >
          <EllipsisVerticalIcon className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="right">
        {onNewChat ? (
          <DropdownMenuItem onSelect={onNewChat}>
            <MessageSquarePlusIcon className="size-4" aria-hidden />
            New document chat
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onSelect={onTogglePin}>
          {isPinned ? (
            <PinOffIcon className="size-4" aria-hidden />
          ) : (
            <PinIcon className="size-4" aria-hidden />
          )}
          {isPinned ? 'Unpin' : 'Pin'}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onRename}>
          <PencilIcon className="size-4" aria-hidden />
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={onDelete}
        >
          <Trash2Icon className="size-4" aria-hidden />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function sortSessions(
  sessions: ChatSessionSchema[],
  pinnedSessionIds: string[] | undefined,
) {
  const pinnedIds = new Set(pinnedSessionIds ?? []);
  return [...sessions].sort((left, right) => {
    const pinDelta =
      Number(pinnedIds.has(right.id)) - Number(pinnedIds.has(left.id));
    if (pinDelta !== 0) return pinDelta;
    return getSessionTimestamp(right) - getSessionTimestamp(left);
  });
}

function getSessionTimestamp(session: ChatSessionSchema) {
  if (typeof session.lastOpenedAt === 'number') return session.lastOpenedAt;
  return session.createdAt instanceof Date
    ? session.createdAt.getTime()
    : Number(session.createdAt ?? 0);
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
