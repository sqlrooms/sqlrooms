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
import {useStoreWithAi} from '../AiSlice';
import type {ChatSessionSchema} from '@sqlrooms/ai-config';

export type AiDebugInspectorExtraSummary =
  | Record<string, unknown>
  | ((context: {
      currentSessionId: string | null;
      selectedSessionId: string | null;
      selectedSession: ChatSessionSchema | undefined;
    }) => Record<string, unknown> | undefined);

export type AiDebugInspectorProps = {
  triggerClassName?: string;
  extraSummary?: AiDebugInspectorExtraSummary;
  devToolsUrl?: string;
};

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

function getToolCallId(part: unknown): string | undefined {
  if (!part || typeof part !== 'object') return undefined;
  const record = part as {type?: unknown; toolCallId?: unknown};
  const type = typeof record.type === 'string' ? record.type : '';
  if (
    !type.startsWith('tool-') &&
    type !== 'dynamic-tool' &&
    type !== 'tool-call'
  ) {
    return undefined;
  }
  return typeof record.toolCallId === 'string' ? record.toolCallId : undefined;
}

function filterRecordByKeys<T>(
  record: Record<string, T>,
  keys: ReadonlySet<string>,
): Record<string, T> {
  return Object.fromEntries(
    Object.entries(record).filter(([key]) => keys.has(key)),
  );
}

function resolveExtraSummary(
  extraSummary: AiDebugInspectorExtraSummary | undefined,
  context: {
    currentSessionId: string | null;
    selectedSessionId: string | null;
    selectedSession: ChatSessionSchema | undefined;
  },
): Record<string, unknown> {
  if (!extraSummary) return {};
  if (typeof extraSummary === 'function') {
    return extraSummary(context) ?? {};
  }
  return extraSummary;
}

export const AiDebugInspector: React.FC<AiDebugInspectorProps> = ({
  triggerClassName,
  extraSummary,
  devToolsUrl = 'http://localhost:4983',
}) => {
  const [open, setOpen] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  );
  const [copied, setCopied] = useState(false);

  const sessions = useStoreWithAi((state) => state.ai.config.sessions);
  const openSessionTabs = useStoreWithAi(
    (state) => state.ai.config.openSessionTabs,
  );
  const currentSessionId = useStoreWithAi(
    (state) => state.ai.getCurrentSession()?.id ?? null,
  );
  const chatEndpoint = useStoreWithAi((state) => state.ai.chatEndPoint);
  const agentProgress = useStoreWithAi((state) => state.ai.agentProgress);
  const toolTimings = useStoreWithAi((state) => state.ai.toolTimings);
  const pendingSubAgentApprovals = useStoreWithAi(
    (state) => state.ai.pendingSubAgentApprovals,
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

  const selectedToolCallIds = useMemo(() => {
    const ids = new Set<string>();
    for (const message of selectedSession?.uiMessages ?? []) {
      for (const part of message.parts ?? []) {
        const toolCallId = getToolCallId(part);
        if (toolCallId) ids.add(toolCallId);
      }

      const metadata = message.metadata as
        | {toolTimings?: Record<string, unknown>}
        | undefined;
      for (const toolCallId of Object.keys(metadata?.toolTimings ?? {})) {
        ids.add(toolCallId);
      }
    }
    return ids;
  }, [selectedSession]);

  const selectedAgentProgress = useMemo(
    () => filterRecordByKeys(agentProgress, selectedToolCallIds),
    [agentProgress, selectedToolCallIds],
  );
  const selectedToolTimings = useMemo(
    () => filterRecordByKeys(toolTimings, selectedToolCallIds),
    [selectedToolCallIds, toolTimings],
  );
  const selectedPendingSubAgentApprovals = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(pendingSubAgentApprovals).filter(([, approval]) =>
          selectedToolCallIds.has(approval.toolCallId),
        ),
      ),
    [pendingSubAgentApprovals, selectedToolCallIds],
  );

  const selectedToolStateIsEmpty =
    selectedToolCallIds.size === 0 &&
    Object.keys(selectedAgentProgress).length === 0 &&
    Object.keys(selectedToolTimings).length === 0 &&
    Object.keys(selectedPendingSubAgentApprovals).length === 0;

  const resolvedExtraSummary = useMemo(
    () =>
      resolveExtraSummary(extraSummary, {
        currentSessionId,
        selectedSessionId,
        selectedSession,
      }),
    [currentSessionId, extraSummary, selectedSession, selectedSessionId],
  );

  const summary = useMemo(
    () => ({
      currentSessionId,
      selectedSessionId,
      ...resolvedExtraSummary,
      transport: chatEndpoint?.trim() ? 'remote' : 'local',
      openSessionTabs,
      sessionCount: sessions.length,
      selectedMessageCount: selectedSession?.uiMessages?.length ?? 0,
      selectedMessagesRevision: selectedSession?.messagesRevision ?? 0,
      selectedIsRunning: selectedSession?.isRunning ?? false,
      selectedToolCallCount: selectedToolCallIds.size,
      agentProgressCount: Object.keys(selectedAgentProgress).length,
      pendingApprovalCount: Object.keys(selectedPendingSubAgentApprovals)
        .length,
      toolTimingCount: Object.keys(selectedToolTimings).length,
    }),
    [
      chatEndpoint,
      currentSessionId,
      openSessionTabs,
      resolvedExtraSummary,
      selectedAgentProgress,
      selectedPendingSubAgentApprovals,
      selectedSession,
      selectedSessionId,
      selectedToolCallIds,
      selectedToolTimings,
      sessions.length,
    ],
  );

  const selectedJson = useMemo(
    () =>
      stringifyDebugValue({
        summary,
        selectedSession,
        messageRows,
        selectedAgentProgress,
        selectedToolCallIds: Array.from(selectedToolCallIds),
        selectedToolTimings,
        selectedPendingSubAgentApprovals,
      }),
    [
      messageRows,
      selectedAgentProgress,
      selectedPendingSubAgentApprovals,
      selectedSession,
      summary,
      selectedToolCallIds,
      selectedToolTimings,
    ],
  );

  const copySelectedJson = async () => {
    await navigator.clipboard?.writeText(selectedJson);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

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
                onClick={() => window.open(devToolsUrl, '_blank', 'noreferrer')}
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
                {selectedToolStateIsEmpty ? (
                  <div className="text-muted-foreground p-4 text-sm">
                    No tool calls recorded for this session.
                  </div>
                ) : (
                  <pre className="p-3 text-xs whitespace-pre-wrap">
                    {stringifyDebugValue({
                      toolCallIds: Array.from(selectedToolCallIds),
                      agentProgress: selectedAgentProgress,
                      toolTimings: selectedToolTimings,
                      pendingSubAgentApprovals:
                        selectedPendingSubAgentApprovals,
                    })}
                  </pre>
                )}
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
