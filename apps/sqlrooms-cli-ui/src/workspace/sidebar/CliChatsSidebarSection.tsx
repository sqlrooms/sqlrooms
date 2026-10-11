import type {ChatSessionSchema} from '@sqlrooms/ai';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  ScrollArea,
  ScrollBar,
  SidebarMenu,
  SidebarMenuItem,
} from '@sqlrooms/ui';
import {
  EllipsisVerticalIcon,
  LoaderCircleIcon,
  MessageSquareIcon,
  PencilIcon,
  PinIcon,
  PinOffIcon,
  PlusIcon,
  Trash2Icon,
} from 'lucide-react';
import {FormEvent, useCallback, useEffect, useMemo, useState} from 'react';
import {isCreateSessionDisabled} from '../../components/sessionCreation';
import {useRoomStore} from '../../roomStoreHooks';

export function CliChatsSidebarSection() {
  const sessions = useRoomStore((state) => state.ai.config.sessions);
  const currentSessionId = useRoomStore(
    (state) => state.ai.config.currentSessionId,
  );
  const pinnedSessionIds = useRoomStore(
    (state) => state.ai.config.pinnedSessionIds,
  );
  const currentSession = useRoomStore((state) => state.ai.getCurrentSession());
  const createSession = useRoomStore((state) => state.ai.createSession);
  const switchSession = useRoomStore((state) => state.ai.switchSession);
  const renameSession = useRoomStore((state) => state.ai.renameSession);
  const deleteSession = useRoomStore((state) => state.ai.deleteSession);
  const togglePinSession = useRoomStore((state) => state.ai.togglePinSession);
  const setCollapsed = useRoomStore((state) => state.layout.setCollapsed);
  const [sessionToRename, setSessionToRename] =
    useState<ChatSessionSchema | null>(null);
  const [sessionToDelete, setSessionToDelete] =
    useState<ChatSessionSchema | null>(null);
  const createSessionDisabled = isCreateSessionDisabled(currentSession);

  const sortedSessions = useMemo(() => {
    const pinnedIds = new Set(pinnedSessionIds ?? []);
    return [...sessions].sort((left, right) => {
      const pinDelta =
        Number(pinnedIds.has(right.id)) - Number(pinnedIds.has(left.id));
      if (pinDelta !== 0) return pinDelta;
      const leftTime =
        left.createdAt instanceof Date
          ? left.createdAt.getTime()
          : (left.createdAt ?? 0);
      const rightTime =
        right.createdAt instanceof Date
          ? right.createdAt.getTime()
          : (right.createdAt ?? 0);
      return rightTime - leftTime;
    });
  }, [pinnedSessionIds, sessions]);

  const handleCreateChat = useCallback(() => {
    if (createSessionDisabled) return;
    createSession();
    setCollapsed('assistant-sidebar', false);
  }, [createSession, createSessionDisabled, setCollapsed]);

  const handleSelectChat = useCallback(
    (sessionId: string) => {
      switchSession(sessionId);
      setCollapsed('assistant-sidebar', false);
    },
    [setCollapsed, switchSession],
  );

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <div className="mb-1 flex h-7 shrink-0 items-center justify-end px-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-primary hover:bg-primary/10 hover:text-primary h-6 gap-1 px-2 text-sm"
          onClick={handleCreateChat}
          disabled={createSessionDisabled}
        >
          <PlusIcon className="h-3.5 w-3.5" aria-hidden />
          New Chat
        </Button>
      </div>
      <ScrollArea className="min-h-0 min-w-0 flex-1 overflow-hidden [&_[data-radix-scroll-area-viewport]>div]:!block [&_[data-radix-scroll-area-viewport]>div]:!w-full [&_[data-radix-scroll-area-viewport]>div]:!min-w-0">
        <div className="w-full max-w-full min-w-0 py-0.5 pr-2 pl-0.5">
          <SidebarMenu className="max-w-full min-w-0 gap-0.5">
            {sortedSessions.length === 0 ? (
              <div className="text-muted-foreground px-2 py-8 text-center text-sm">
                No chats yet. Click &quot;New Chat&quot; to start.
              </div>
            ) : (
              sortedSessions.map((session) => {
                const isPinned =
                  pinnedSessionIds?.includes(session.id) ?? false;
                return (
                  <SidebarMenuItem
                    key={session.id}
                    className="group/chat min-w-0"
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectChat(session.id)}
                      className={`hover:bg-sidebar-accent flex h-8 w-full min-w-0 items-center gap-2 rounded-md pr-8 pl-2 text-left text-sm transition-colors ${
                        session.id === currentSessionId
                          ? 'bg-primary/15 text-primary'
                          : ''
                      }`}
                      title={session.name}
                    >
                      {session.isRunning ? (
                        <LoaderCircleIcon className="text-primary h-4 w-4 shrink-0 animate-spin" />
                      ) : (
                        <MessageSquareIcon
                          className="h-4 w-4 shrink-0"
                          aria-hidden
                        />
                      )}
                      <span className="min-w-0 flex-1 truncate">
                        {session.name}
                      </span>
                      {isPinned ? (
                        <PinIcon className="h-3.5 w-3.5 shrink-0 opacity-60 group-hover/chat:opacity-0" />
                      ) : null}
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover/chat:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
                          aria-label={`Actions for ${session.name}`}
                        >
                          <EllipsisVerticalIcon className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" side="right">
                        <DropdownMenuItem
                          onSelect={() => togglePinSession(session.id)}
                        >
                          {isPinned ? (
                            <PinOffIcon className="h-4 w-4" />
                          ) : (
                            <PinIcon className="h-4 w-4" />
                          )}
                          {isPinned ? 'Unpin' : 'Pin'}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => setSessionToRename(session)}
                        >
                          <PencilIcon className="h-4 w-4" />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onSelect={() => setSessionToDelete(session)}
                        >
                          <Trash2Icon className="h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </SidebarMenuItem>
                );
              })
            )}
          </SidebarMenu>
        </div>
        <ScrollBar orientation="vertical" />
      </ScrollArea>
      <RenameChatDialog
        session={sessionToRename}
        onOpenChange={(open) => {
          if (!open) setSessionToRename(null);
        }}
        onRename={(sessionId, name) => {
          renameSession(sessionId, name);
          setSessionToRename(null);
        }}
      />
      <DeleteChatDialog
        session={sessionToDelete}
        onOpenChange={(open) => {
          if (!open) setSessionToDelete(null);
        }}
        onConfirm={() => {
          if (sessionToDelete) deleteSession(sessionToDelete.id);
          setSessionToDelete(null);
        }}
      />
    </div>
  );
}

function RenameChatDialog({
  session,
  onOpenChange,
  onRename,
}: {
  session: ChatSessionSchema | null;
  onOpenChange: (open: boolean) => void;
  onRename: (sessionId: string, name: string) => void;
}) {
  const [name, setName] = useState('');

  useEffect(() => {
    setName(session?.name ?? '');
  }, [session]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (session && trimmedName) onRename(session.id, trimmedName);
  };

  return (
    <Dialog open={Boolean(session)} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Rename chat</DialogTitle>
            <DialogDescription>Choose a name for this chat.</DialogDescription>
          </DialogHeader>
          <Input
            className="my-4"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">Rename</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteChatDialog({
  session,
  onOpenChange,
  onConfirm,
}: {
  session: ChatSessionSchema | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={Boolean(session)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete chat</DialogTitle>
          <DialogDescription>
            Delete &ldquo;{session?.name ?? 'this chat'}&rdquo;? Linked
            artifacts will be kept.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
