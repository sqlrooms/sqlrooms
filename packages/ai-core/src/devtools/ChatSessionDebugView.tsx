import {
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  cn,
  ScrollArea,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  ToggleGroup,
  ToggleGroupItem,
} from '@sqlrooms/ui';
import {ChevronRightIcon, FilterIcon, XIcon} from 'lucide-react';
import React, {useMemo} from 'react';
import {useStoreWithAi} from '../AiSlice';
import type {AgentSnapshot, AgentToolCall} from '../types';
import {DebugJsonBlock} from './DebugJsonBlock';
import {
  getAvailableToolDebugInfo,
  getSessionDebugSummary,
  getSessionDebugTimeline,
  type DebugTimelineMessage,
} from './sessionDebugModel';

export type ChatSessionDebugViewProps = {
  /** Chat session id to inspect from the current AI store context. */
  sessionId: string;
  /** Optional wrapper class for embedding the inspector in panels or overlays. */
  className?: string;
  /** Initial tab to show. Defaults to the chronological timeline. */
  defaultTab?: string;
  /** Optional close handler for host panels that can dismiss the inspector. */
  onClose?: () => void;
  /** @deprecated Use defaultTab. Kept as a no-op for the initial accordion API. */
  defaultExpandedSections?: string[];
};

const DEFAULT_TAB = 'timeline';

type TimelineFilterKind = 'user' | 'assistant' | 'tool' | 'agent';

type TimelineFilterOption = {
  value: TimelineFilterKind;
  label: string;
  count: number;
};

type TimelineFilterMode =
  | {type: 'all'}
  | {type: 'custom'; filters: TimelineFilterKind[]};

function formatDate(date: Date | undefined): string {
  return date ? date.toLocaleString() : 'n/a';
}

function formatNumber(value: number | undefined): string {
  return typeof value === 'number' ? value.toLocaleString() : 'n/a';
}

const KeyValue: React.FC<{label: string; value: React.ReactNode}> = ({
  label,
  value,
}) => (
  <div className="min-w-0">
    <div className="text-muted-foreground text-[11px] uppercase">{label}</div>
    <div className="truncate text-xs font-medium">{value}</div>
  </div>
);

const StatusPill: React.FC<{
  children: React.ReactNode;
  tone?: 'ok' | 'warn';
  size?: 'default' | 'compact';
}> = ({children, tone, size = 'default'}) => (
  <span
    className={cn(
      'inline-flex items-center rounded border font-medium',
      size === 'compact'
        ? 'px-1 py-0 text-[10px]'
        : 'px-1.5 py-0.5 text-[11px]',
      tone === 'ok' &&
        'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
      tone === 'warn' &&
        'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
      !tone && 'border-border bg-muted text-muted-foreground',
    )}
  >
    {children}
  </span>
);

const ToolCapabilityBadges: React.FC<{
  hasExecute?: boolean;
  hasRenderer?: boolean;
}> = ({hasExecute, hasRenderer}) => {
  if (typeof hasExecute !== 'boolean' && typeof hasRenderer !== 'boolean') {
    return null;
  }

  return (
    <>
      {typeof hasExecute === 'boolean' && (
        <StatusPill size="compact" tone={hasExecute ? 'ok' : undefined}>
          {hasExecute ? 'execute' : 'no execute'}
        </StatusPill>
      )}
      {typeof hasRenderer === 'boolean' && (
        <StatusPill size="compact" tone={hasRenderer ? 'ok' : undefined}>
          {hasRenderer ? 'renderer' : 'no renderer'}
        </StatusPill>
      )}
    </>
  );
};

const EmptyState: React.FC<{children: React.ReactNode}> = ({children}) => (
  <div className="text-muted-foreground py-6 text-center text-xs">
    {children}
  </div>
);

const TimelineFilterBar: React.FC<{
  mode: TimelineFilterMode;
  options: TimelineFilterOption[];
  onModeChange: (mode: TimelineFilterMode) => void;
}> = ({mode, options, onModeChange}) => {
  const filters =
    mode.type === 'all' ? options.map((option) => option.value) : mode.filters;
  const allFiltersSelected = options.every((option) =>
    filters.includes(option.value),
  );

  return (
    <div className="flex w-full gap-2 overflow-x-auto px-3 pt-1 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <ToggleGroup
        type="multiple"
        value={filters}
        onValueChange={(nextValue) => {
          const nextFilters = nextValue as TimelineFilterKind[];

          if (mode.type === 'all') {
            const clickedFilter = options.find(
              (option) => !nextFilters.includes(option.value),
            )?.value;
            onModeChange({
              type: 'custom',
              filters: clickedFilter ? [clickedFilter] : nextFilters,
            });
            return;
          }

          onModeChange({type: 'custom', filters: nextFilters});
        }}
        className="shrink-0 justify-start"
      >
        {options.map((option) => (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            size="sm"
            variant="outline"
            className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground h-6 shrink-0 gap-1 rounded-full px-2 text-[11px]"
          >
            <span>{option.label}</span>
            <span className="opacity-70">{option.count}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <Button
        type="button"
        size="xs"
        variant="ghost"
        className="text-muted-foreground hover:text-foreground h-6 w-14 shrink-0 px-1.5 text-[11px]"
        onClick={() =>
          onModeChange(
            allFiltersSelected ? {type: 'custom', filters: []} : {type: 'all'},
          )
        }
      >
        {allFiltersSelected ? 'Hide all' : 'Show all'}
      </Button>
    </div>
  );
};

type DebugToolListItem = {
  name: string;
  badges?: React.ReactNode;
  details: React.ReactNode;
};

const DebugToolRows: React.FC<{tools: DebugToolListItem[]}> = ({tools}) => (
  <div className="grid gap-1">
    {tools.map((tool) => (
      <Collapsible key={tool.name}>
        <CollapsibleTrigger className="group flex w-full min-w-0 items-center gap-1.5 py-1 text-left text-xs">
          <ChevronRightIcon className="text-muted-foreground h-3 w-3 shrink-0 transition-transform group-data-[state=open]:rotate-90" />
          <span className="min-w-0 flex-1 truncate font-medium">
            {tool.name}
          </span>
          {tool.badges && (
            <span className="ml-auto flex shrink-0 items-center justify-end gap-1">
              {tool.badges}
            </span>
          )}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="text-muted-foreground grid gap-1 pb-2 pl-4 text-[11px]">
            {tool.details}
          </div>
        </CollapsibleContent>
      </Collapsible>
    ))}
  </div>
);

const DebugToolList: React.FC<{
  title: string;
  tools: DebugToolListItem[];
}> = ({title, tools}) => {
  if (tools.length === 0) return null;

  return (
    <Collapsible className="bg-muted/20 rounded-md">
      <div className="flex min-w-0 items-center gap-2 px-2 py-1.5">
        <CollapsibleTrigger className="group flex min-w-0 flex-1 items-center gap-1.5 text-left text-xs font-medium">
          <ChevronRightIcon className="text-muted-foreground h-3.5 w-3.5 shrink-0 transition-transform group-data-[state=open]:rotate-90" />
          <span className="truncate">{title}</span>
          <span className="text-muted-foreground text-[11px]">
            {tools.length}
          </span>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        <div className="grid gap-1 px-2 pb-2">
          <DebugToolRows tools={tools} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

const AgentAvailableTools: React.FC<{
  snapshot: AgentSnapshot | undefined;
}> = ({snapshot}) => (
  <DebugToolList
    title="Agent tools"
    tools={(snapshot?.availableTools ?? []).map((tool) => ({
      name: tool.name,
      badges: (
        <>
          <ToolCapabilityBadges
            hasExecute={tool.hasExecute}
            hasRenderer={tool.hasRenderer}
          />
          {tool.needsApproval && (
            <StatusPill size="compact" tone="warn">
              approval
            </StatusPill>
          )}
        </>
      ),
      details: <div>{tool.description || 'No description.'}</div>,
    }))}
  />
);

const AgentToolCallTree: React.FC<{
  toolCalls: AgentToolCall[];
  agentProgressById: Record<string, AgentToolCall[]>;
  agentSnapshotsById: Record<string, AgentSnapshot>;
  depth?: number;
}> = ({toolCalls, agentProgressById, agentSnapshotsById, depth = 0}) => {
  if (toolCalls.length === 0) {
    return <EmptyState>No nested agent tool calls recorded.</EmptyState>;
  }

  return (
    <div className="flex flex-col gap-2">
      {toolCalls.map((toolCall) => {
        const nestedCalls =
          agentProgressById[toolCall.toolCallId] ??
          toolCall.agentToolCalls ??
          [];
        const snapshot = agentSnapshotsById[toolCall.toolCallId];

        return (
          <div
            key={toolCall.toolCallId}
            className={cn('bg-muted/20 rounded-md p-2', depth > 0 && 'ml-3')}
          >
            <div className="mb-2 flex min-w-0 items-center gap-2">
              <StatusPill
                tone={
                  toolCall.state === 'success'
                    ? 'ok'
                    : toolCall.state === 'pending' ||
                        toolCall.state === 'approval-requested'
                      ? 'warn'
                      : undefined
                }
              >
                {toolCall.state}
              </StatusPill>
              <span className="truncate text-xs font-medium">
                {toolCall.toolName}
              </span>
              <span className="text-muted-foreground ml-auto truncate text-[11px]">
                {toolCall.toolCallId}
              </span>
            </div>
            <div className="grid gap-2">
              <AgentAvailableTools snapshot={snapshot} />
              {toolCall.input !== undefined && (
                <DebugJsonBlock title="Input" value={toolCall.input} />
              )}
              {toolCall.output !== undefined && (
                <DebugJsonBlock title="Output" value={toolCall.output} />
              )}
              {toolCall.errorText && (
                <DebugJsonBlock
                  title="Error"
                  value={toolCall.errorText}
                  defaultOpen
                />
              )}
              {nestedCalls.length > 0 && (
                <AgentToolCallTree
                  toolCalls={nestedCalls}
                  agentProgressById={agentProgressById}
                  agentSnapshotsById={agentSnapshotsById}
                  depth={depth + 1}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

function timelineMessageHasToolCall(message: DebugTimelineMessage): boolean {
  return message.parts.some((part) => part.kind === 'tool');
}

function timelineMessageHasAgentWork(message: DebugTimelineMessage): boolean {
  return message.parts.some(
    (part) =>
      part.kind === 'tool' &&
      (Boolean(part.agentProgress) || Boolean(part.agentSnapshot)),
  );
}

function timelineMessageMatchesFilters(
  message: DebugTimelineMessage,
  filters: TimelineFilterKind[],
): boolean {
  if (filters.length === 0) return false;

  return filters.some((filter) => {
    if (filter === 'user') return message.message.role === 'user';
    if (filter === 'assistant') return message.message.role === 'assistant';
    if (filter === 'tool') return timelineMessageHasToolCall(message);
    return timelineMessageHasAgentWork(message);
  });
}

/** Development inspector for a chat session, including messages, tool calls, and nested agent work. */
export const ChatSessionDebugView: React.FC<ChatSessionDebugViewProps> = ({
  sessionId,
  className,
  defaultTab = DEFAULT_TAB,
  onClose,
}) => {
  const [activeTab, setActiveTab] = React.useState(defaultTab);
  const [timelineFiltersOpen, setTimelineFiltersOpen] = React.useState(false);
  const [timelineFilterMode, setTimelineFilterMode] =
    React.useState<TimelineFilterMode>({type: 'all'});
  const sessions = useStoreWithAi((state) => state.ai.config.sessions);
  const tools = useStoreWithAi((state) => state.ai.tools);
  const toolRenderers = useStoreWithAi((state) => state.ai.toolRenderers);
  const liveAgentProgress = useStoreWithAi((state) => state.ai.agentProgress);
  const liveAgentSnapshots = useStoreWithAi((state) => state.ai.agentSnapshots);
  const toolTimings = useStoreWithAi((state) => state.ai.toolTimings);

  const session = useMemo(
    () => sessions.find((candidate) => candidate.id === sessionId),
    [sessionId, sessions],
  );

  const summary = useMemo(
    () => (session ? getSessionDebugSummary(session) : undefined),
    [session],
  );
  const timeline = useMemo(
    () =>
      session
        ? getSessionDebugTimeline({
            session,
            liveAgentProgress,
            liveAgentSnapshots,
          })
        : [],
    [liveAgentProgress, liveAgentSnapshots, session],
  );
  const allAgentProgressById = useMemo(
    () => ({
      ...(((session?.agentProgress as
        | Record<string, AgentToolCall[]>
        | undefined) ?? {}) as Record<string, AgentToolCall[]>),
      ...liveAgentProgress,
    }),
    [liveAgentProgress, session],
  );
  const allAgentSnapshotsById = useMemo(
    () => ({
      ...(((session?.agentSnapshots as
        | Record<string, AgentSnapshot>
        | undefined) ?? {}) as Record<string, AgentSnapshot>),
      ...liveAgentSnapshots,
    }),
    [liveAgentSnapshots, session],
  );
  const availableTools = useMemo(
    () => getAvailableToolDebugInfo(tools, toolRenderers),
    [toolRenderers, tools],
  );
  const timelineFilterOptions = useMemo<TimelineFilterOption[]>(() => {
    const userCount = timeline.filter(
      (item) => item.message.role === 'user',
    ).length;
    const assistantCount = timeline.filter(
      (item) => item.message.role === 'assistant',
    ).length;
    const toolCallCount = timeline.reduce(
      (count, item) =>
        count + item.parts.filter((part) => part.kind === 'tool').length,
      0,
    );
    const agentCount = timeline.reduce(
      (count, item) =>
        count +
        item.parts.filter(
          (part) =>
            part.kind === 'tool' &&
            (Boolean(part.agentProgress) || Boolean(part.agentSnapshot)),
        ).length,
      0,
    );

    return [
      {value: 'user', label: 'User', count: userCount},
      {value: 'assistant', label: 'Assistant', count: assistantCount},
      {value: 'tool', label: 'Tool calls', count: toolCallCount},
      {value: 'agent', label: 'Agent', count: agentCount},
    ];
  }, [timeline]);
  const filteredTimeline = useMemo(() => {
    if (timelineFilterMode.type === 'all') return timeline;

    return timeline.filter((message) =>
      timelineMessageMatchesFilters(message, timelineFilterMode.filters),
    );
  }, [timeline, timelineFilterMode]);

  if (!session || !summary) {
    return (
      <div
        className={cn(
          'text-muted-foreground flex h-full min-h-40 items-center justify-center text-sm',
          className,
        )}
      >
        Session not found: {sessionId}
      </div>
    );
  }

  return (
    <div className={cn('flex h-full min-h-0 flex-col text-sm', className)}>
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="flex items-center gap-1 px-2 pt-0 pb-1">
          <TabsList className="h-8 min-w-0 flex-1 justify-start overflow-x-auto bg-transparent p-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <TabsTrigger value="timeline" className="h-7 px-2 text-xs">
              Timeline
            </TabsTrigger>
            <TabsTrigger value="tools" className="h-7 px-2 text-xs">
              Tools
            </TabsTrigger>
            <TabsTrigger value="context" className="h-7 px-2 text-xs">
              Context
            </TabsTrigger>
            <TabsTrigger value="raw-session" className="h-7 px-2 text-xs">
              Raw
            </TabsTrigger>
            <TabsTrigger value="summary" className="h-7 px-2 text-xs">
              Summary
            </TabsTrigger>
          </TabsList>
          {activeTab === 'timeline' && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                'text-muted-foreground hover:text-foreground h-7 w-7 shrink-0',
                timelineFiltersOpen && 'bg-muted text-foreground',
              )}
              aria-label={
                timelineFiltersOpen
                  ? 'Hide timeline filters'
                  : 'Show timeline filters'
              }
              aria-pressed={timelineFiltersOpen}
              onClick={() => setTimelineFiltersOpen((open) => !open)}
            >
              <FilterIcon className="h-3.5 w-3.5" />
            </Button>
          )}
          {onClose && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground h-7 w-7 shrink-0"
              aria-label="Close debug panel"
              onClick={onClose}
            >
              <XIcon className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {activeTab === 'timeline' && timelineFiltersOpen && (
          <TimelineFilterBar
            mode={timelineFilterMode}
            options={timelineFilterOptions}
            onModeChange={setTimelineFilterMode}
          />
        )}

        <ScrollArea className="min-h-0 flex-1">
          <TabsContent value="summary" className="m-0 px-3 pt-1 pb-8">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <KeyValue label="Session ID" value={summary.sessionId} />
              <KeyValue label="Provider" value={summary.modelProvider} />
              <KeyValue label="Model" value={summary.model} />
              <KeyValue
                label="Custom model"
                value={summary.customModelName ?? 'n/a'}
              />
              <KeyValue label="Base URL" value={summary.baseUrl ?? 'n/a'} />
              <KeyValue label="Created" value={formatDate(summary.createdAt)} />
              <KeyValue
                label="Last opened"
                value={formatNumber(summary.lastOpenedAt)}
              />
              <KeyValue label="Messages" value={summary.messageCount} />
              <KeyValue label="Tool calls" value={summary.toolCallCount} />
              <KeyValue
                label="Agent snapshots"
                value={summary.agentSnapshotCount}
              />
              <KeyValue
                label="Status"
                value={summary.isRunning ? 'running' : 'idle'}
              />
            </div>
          </TabsContent>

          <TabsContent value="tools" className="m-0 px-3 pt-1 pb-8">
            {availableTools.length === 0 ? (
              <EmptyState>No tools registered.</EmptyState>
            ) : (
              <DebugToolRows
                tools={availableTools.map((tool) => ({
                  name: tool.name,
                  badges: (
                    <ToolCapabilityBadges
                      hasExecute={tool.hasExecute}
                      hasRenderer={tool.hasRenderer}
                    />
                  ),
                  details: <div>{tool.description || 'No description.'}</div>,
                }))}
              />
            )}
          </TabsContent>

          <TabsContent value="context" className="m-0 px-3 pt-1 pb-8">
            <DebugJsonBlock
              title="session.runContext"
              value={session.runContext ?? null}
              defaultOpen
              editorClassName="h-56"
            />
          </TabsContent>

          <TabsContent value="timeline" className="m-0 px-3 pt-1 pb-10">
            {timeline.length === 0 ? (
              <EmptyState>No messages recorded.</EmptyState>
            ) : filteredTimeline.length === 0 ? (
              <EmptyState>
                No timeline entries match the selected filters.
              </EmptyState>
            ) : (
              <div className="flex flex-col gap-3">
                {filteredTimeline.map(({message, parts}) => (
                  <div key={message.id} className="bg-muted/15 rounded-md p-2">
                    <div className="mb-2 flex min-w-0 items-center gap-2">
                      <StatusPill>{message.role}</StatusPill>
                      <span className="truncate text-xs font-medium">
                        #{message.index} {message.id}
                      </span>
                      <span className="text-muted-foreground ml-auto text-[11px]">
                        {message.partCount} parts
                      </span>
                    </div>
                    <div className="grid gap-2">
                      {parts.map((part) => {
                        if (part.kind === 'text' || part.kind === 'reasoning') {
                          return (
                            <div
                              key={part.index}
                              className={cn(
                                'rounded-md px-2 py-1.5 text-xs whitespace-pre-wrap',
                                part.kind === 'reasoning'
                                  ? 'bg-muted/40 text-muted-foreground italic'
                                  : 'bg-muted/30',
                              )}
                            >
                              {part.text}
                            </div>
                          );
                        }

                        if (part.kind === 'tool') {
                          const {toolCall} = part;
                          const agentSnapshot =
                            part.agentSnapshot?.snapshot ??
                            allAgentSnapshotsById[toolCall.toolCallId];

                          return (
                            <div
                              key={part.index}
                              className="bg-background/70 rounded-md p-2"
                            >
                              <div className="mb-1.5 flex min-w-0 items-center gap-2">
                                <StatusPill>tool call</StatusPill>
                                <span className="min-w-0 truncate text-xs font-medium">
                                  {toolCall.toolName}
                                </span>
                              </div>
                              <div className="text-muted-foreground mb-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                                <StatusPill
                                  tone={
                                    toolCall.state === 'output-available'
                                      ? 'ok'
                                      : toolCall.state === 'input-available' ||
                                          toolCall.state ===
                                            'approval-requested'
                                        ? 'warn'
                                        : undefined
                                  }
                                >
                                  {toolCall.state ?? 'unknown'}
                                </StatusPill>
                                <span className="min-w-0 truncate">
                                  {toolCall.toolCallId}
                                </span>
                                <span>part #{toolCall.partIndex}</span>
                                <span>
                                  timing:{' '}
                                  {toolTimings[toolCall.toolCallId]?.completedAt
                                    ? `${toolTimings[toolCall.toolCallId]!.completedAt! - toolTimings[toolCall.toolCallId]!.startedAt}ms`
                                    : 'n/a'}
                                </span>
                              </div>
                              <div className="grid gap-2">
                                <AgentAvailableTools snapshot={agentSnapshot} />
                                {toolCall.input !== undefined && (
                                  <DebugJsonBlock
                                    title="Input"
                                    value={toolCall.input}
                                    defaultOpen
                                  />
                                )}
                                {toolCall.output !== undefined && (
                                  <DebugJsonBlock
                                    title="Output"
                                    value={toolCall.output}
                                  />
                                )}
                                {toolCall.errorText && (
                                  <DebugJsonBlock
                                    title="Error"
                                    value={toolCall.errorText}
                                    defaultOpen
                                  />
                                )}
                                {part.agentSnapshot && (
                                  <DebugJsonBlock
                                    title={`Agent snapshot (${part.agentSnapshot.source})`}
                                    value={part.agentSnapshot.snapshot}
                                  />
                                )}
                                {part.agentProgress && (
                                  <AgentToolCallTree
                                    toolCalls={part.agentProgress.toolCalls}
                                    agentProgressById={allAgentProgressById}
                                    agentSnapshotsById={allAgentSnapshotsById}
                                  />
                                )}
                                <DebugJsonBlock
                                  title="Raw tool part"
                                  value={toolCall.raw}
                                />
                              </div>
                            </div>
                          );
                        }

                        if (part.kind === 'other') {
                          return (
                            <DebugJsonBlock
                              key={part.index}
                              title={`Part ${part.index}: ${part.type}`}
                              value={part.raw}
                            />
                          );
                        }

                        return null;
                      })}
                      <DebugJsonBlock title="Raw message" value={message.raw} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="raw-session" className="m-0 px-3 pt-1 pb-8">
            <DebugJsonBlock
              title="Session"
              value={session}
              defaultOpen
              editorClassName="h-80"
            />
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
};
