import {
  Badge,
  Button,
  ScrollArea,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@sqlrooms/ui';
import {
  BugIcon,
  ClipboardIcon,
  ExternalLinkIcon,
  MessageSquareIcon,
} from 'lucide-react';
import React, {useEffect, useMemo, useState} from 'react';
import {useRoomStore} from '../store';

function stringifyDebugValue(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function getPartLabel(part: unknown): string {
  if (!part || typeof part !== 'object' || !('type' in part)) {
    return 'unknown';
  }
  const type = String((part as {type?: unknown}).type);
  if (type.startsWith('tool-')) {
    const state = (part as {state?: unknown}).state;
    return state ? `${type}:${String(state)}` : type;
  }
  return type;
}

function getMessageTextPreview(message: {parts?: unknown[]}): string {
  const text = (message.parts ?? [])
    .filter(
      (part): part is {type: string; text: string} =>
        !!part &&
        typeof part === 'object' &&
        (part as {type?: unknown}).type === 'text' &&
        typeof (part as {text?: unknown}).text === 'string',
    )
    .map((part) => part.text)
    .join(' ');
  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}

export const AiDebugInspector: React.FC<{triggerClassName?: string}> = ({
  triggerClassName,
}) => {
  const [open, setOpen] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  );
  const [copied, setCopied] = useState(false);

  const sessions = useRoomStore((state) => state.ai.config.sessions);
  const openSessionTabs = useRoomStore(
    (state) => state.ai.config.openSessionTabs,
  );
  const currentSessionId = useRoomStore(
    (state) => state.ai.getCurrentSession()?.id ?? null,
  );
  const chatEndpoint = useRoomStore((state) => state.ai.chatEndPoint);
  const agentProgress = useRoomStore((state) => state.ai.agentProgress);
  const toolTimings = useRoomStore((state) => state.ai.toolTimings);
  const pendingSubAgentApprovals = useRoomStore(
    (state) => state.ai.pendingSubAgentApprovals,
  );
  const aiSessionArtifacts = useRoomStore(
    (state) => state.artifactAi.config.aiSessionArtifacts,
  );
  const currentArtifactId = useRoomStore(
    (state) => state.artifacts.config.currentArtifactId,
  );

  useEffect(() => {
    if (selectedSessionId && sessions.some((s) => s.id === selectedSessionId)) {
      return;
    }
    setSelectedSessionId(currentSessionId ?? sessions[0]?.id ?? null);
  }, [currentSessionId, selectedSessionId, sessions]);

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId),
    [selectedSessionId, sessions],
  );

  const selectedArtifactId = selectedSessionId
    ? aiSessionArtifacts[selectedSessionId]
    : undefined;

  const messageRows = useMemo(
    () =>
      (selectedSession?.uiMessages ?? []).map((message, index) => ({
        id: message.id,
        index,
        role: message.role,
        parts: message.parts?.map(getPartLabel) ?? [],
        preview: getMessageTextPreview(message),
        metadata: message.metadata,
      })),
    [selectedSession],
  );

  const summary = useMemo(
    () => ({
      currentSessionId,
      selectedSessionId,
      currentArtifactId,
      selectedArtifactId,
      transport: chatEndpoint?.trim() ? 'remote' : 'local',
      openSessionTabs,
      sessionCount: sessions.length,
      selectedMessageCount: selectedSession?.uiMessages?.length ?? 0,
      selectedMessagesRevision: selectedSession?.messagesRevision ?? 0,
      selectedIsRunning: selectedSession?.isRunning ?? false,
      agentProgressCount: Object.keys(agentProgress).length,
      pendingApprovalCount: Object.keys(pendingSubAgentApprovals).length,
      toolTimingCount: Object.keys(toolTimings).length,
    }),
    [
      agentProgress,
      chatEndpoint,
      currentArtifactId,
      currentSessionId,
      openSessionTabs,
      pendingSubAgentApprovals,
      selectedArtifactId,
      selectedSession,
      selectedSessionId,
      sessions.length,
      toolTimings,
    ],
  );

  const selectedJson = useMemo(
    () =>
      stringifyDebugValue({
        summary,
        selectedSession,
        messageRows,
        agentProgress,
        toolTimings,
        pendingSubAgentApprovals,
      }),
    [
      agentProgress,
      messageRows,
      pendingSubAgentApprovals,
      selectedSession,
      summary,
      toolTimings,
    ],
  );

  const copySelectedJson = async () => {
    await navigator.clipboard?.writeText(selectedJson);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  if (!import.meta.env.DEV) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className={triggerClassName}
            aria-label="AI DevTools"
            onClick={() => setOpen(true)}
          >
            <BugIcon className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">AI DevTools</TooltipContent>
      </Tooltip>
      <SheetContent className="flex w-[min(100vw,760px)] max-w-none flex-col gap-4 p-4 sm:max-w-none">
        <SheetHeader>
          <div className="flex items-start justify-between gap-3 pr-8">
            <div>
              <SheetTitle>AI Debug</SheetTitle>
              <SheetDescription>
                Session messages, tool state, and AI SDK DevTools handoff.
              </SheetDescription>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() =>
                  window.open('http://localhost:4983', '_blank', 'noreferrer')
                }
              >
                <ExternalLinkIcon className="h-3.5 w-3.5" />
                DevTools
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={copySelectedJson}
              >
                <ClipboardIcon className="h-3.5 w-3.5" />
                {copied ? 'Copied' : 'Copy JSON'}
              </Button>
            </div>
          </div>
        </SheetHeader>

        <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
          <div className="rounded-md border p-2">
            <div className="text-muted-foreground">Transport</div>
            <div className="font-medium">{summary.transport}</div>
          </div>
          <div className="rounded-md border p-2">
            <div className="text-muted-foreground">Messages</div>
            <div className="font-medium">{summary.selectedMessageCount}</div>
          </div>
          <div className="rounded-md border p-2">
            <div className="text-muted-foreground">Revision</div>
            <div className="font-medium">
              {summary.selectedMessagesRevision}
            </div>
          </div>
          <div className="rounded-md border p-2">
            <div className="text-muted-foreground">Running</div>
            <div className="font-medium">
              {summary.selectedIsRunning ? 'yes' : 'no'}
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 gap-3">
          <div className="w-56 shrink-0 overflow-hidden rounded-md border">
            <ScrollArea className="h-full">
              <div className="p-2">
                {sessions.map((session) => (
                  <button
                    key={session.id}
                    type="button"
                    className={`hover:bg-accent flex w-full flex-col gap-1 rounded-md p-2 text-left text-xs ${
                      session.id === selectedSessionId ? 'bg-accent' : ''
                    }`}
                    onClick={() => setSelectedSessionId(session.id)}
                  >
                    <div className="flex items-center gap-1">
                      <MessageSquareIcon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate font-medium">
                        {session.name}
                      </span>
                    </div>
                    <div className="text-muted-foreground truncate">
                      {session.modelProvider}/{session.model}
                    </div>
                    <div className="flex gap-1">
                      {session.id === currentSessionId && (
                        <Badge variant="secondary">current</Badge>
                      )}
                      {session.isRunning && (
                        <Badge variant="outline">running</Badge>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>

          <Tabs
            defaultValue="messages"
            className="flex min-w-0 flex-1 flex-col"
          >
            <TabsList className="grid shrink-0 grid-cols-4">
              <TabsTrigger value="messages">Messages</TabsTrigger>
              <TabsTrigger value="session">Session</TabsTrigger>
              <TabsTrigger value="tools">Tools</TabsTrigger>
              <TabsTrigger value="json">JSON</TabsTrigger>
            </TabsList>

            <TabsContent value="messages" className="min-h-0 flex-1">
              <ScrollArea className="h-full rounded-md border">
                <div className="space-y-2 p-3">
                  {messageRows.map((message) => (
                    <div key={message.id} className="rounded-md border p-2">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <div className="flex min-w-0 items-center gap-2">
                          <Badge variant="outline">#{message.index + 1}</Badge>
                          <span className="font-medium">{message.role}</span>
                          <span className="text-muted-foreground truncate">
                            {message.id}
                          </span>
                        </div>
                        {message.metadata ? <Badge>metadata</Badge> : null}
                      </div>
                      {message.preview && (
                        <div className="mt-2 text-sm">{message.preview}</div>
                      )}
                      <div className="mt-2 flex flex-wrap gap-1">
                        {message.parts.map((part, index) => (
                          <Badge
                            key={`${message.id}-${index}`}
                            variant="secondary"
                          >
                            {part}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                  {messageRows.length === 0 && (
                    <div className="text-muted-foreground p-4 text-sm">
                      No messages in this session.
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="session" className="min-h-0 flex-1">
              <ScrollArea className="h-full rounded-md border">
                <pre className="p-3 text-xs whitespace-pre-wrap">
                  {stringifyDebugValue({summary, selectedSession})}
                </pre>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="tools" className="min-h-0 flex-1">
              <ScrollArea className="h-full rounded-md border">
                <pre className="p-3 text-xs whitespace-pre-wrap">
                  {stringifyDebugValue({
                    agentProgress,
                    toolTimings,
                    pendingSubAgentApprovals,
                  })}
                </pre>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="json" className="min-h-0 flex-1">
              <ScrollArea className="h-full rounded-md border">
                <pre className="p-3 text-xs whitespace-pre-wrap">
                  {selectedJson}
                </pre>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
};
