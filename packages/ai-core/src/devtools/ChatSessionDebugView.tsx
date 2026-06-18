import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  cn,
} from '@sqlrooms/ui';
import {BugIcon} from 'lucide-react';
import React, {useMemo} from 'react';
import {useStoreWithAi} from '../AiSlice';
import type {AgentToolCall} from '../types';
import {DebugJsonBlock} from './DebugJsonBlock';
import {
  getAvailableToolDebugInfo,
  getSessionDebugAgentProgress,
  getSessionDebugAgentSnapshots,
  getSessionDebugMessages,
  getSessionDebugSummary,
  getSessionDebugToolCalls,
} from './sessionDebugModel';

export type ChatSessionDebugViewProps = {
  sessionId: string;
  className?: string;
  defaultExpandedSections?: string[];
};

const DEFAULT_EXPANDED_SECTIONS = ['summary', 'messages', 'tools'];

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

const StatusPill: React.FC<{children: React.ReactNode; tone?: 'ok' | 'warn'}> =
  ({children, tone}) => (
    <span
      className={cn(
        'inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium',
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

const EmptyState: React.FC<{children: React.ReactNode}> = ({children}) => (
  <div className="text-muted-foreground py-6 text-center text-xs">
    {children}
  </div>
);

const AgentToolCallTree: React.FC<{
  toolCalls: AgentToolCall[];
  depth?: number;
}> = ({toolCalls, depth = 0}) => {
  if (toolCalls.length === 0) return <EmptyState>No agent calls recorded.</EmptyState>;

  return (
    <div className="flex flex-col gap-2">
      {toolCalls.map((toolCall) => (
        <div
          key={toolCall.toolCallId}
          className={cn(
            'border-border bg-background rounded-md border p-2',
            depth > 0 && 'ml-3',
          )}
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
            {toolCall.agentToolCalls?.length ? (
              <AgentToolCallTree
                toolCalls={toolCall.agentToolCalls}
                depth={depth + 1}
              />
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
};

export const ChatSessionDebugView: React.FC<ChatSessionDebugViewProps> = ({
  sessionId,
  className,
  defaultExpandedSections = DEFAULT_EXPANDED_SECTIONS,
}) => {
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
  const messages = useMemo(
    () => (session ? getSessionDebugMessages(session) : []),
    [session],
  );
  const agentProgress = useMemo(
    () =>
      session
        ? getSessionDebugAgentProgress(session, liveAgentProgress)
        : [],
    [liveAgentProgress, session],
  );
  const agentProgressById = useMemo(
    () =>
      Object.fromEntries(
        agentProgress.map((entry) => [entry.parentToolCallId, entry.toolCalls]),
      ),
    [agentProgress],
  );
  const agentSnapshots = useMemo(
    () =>
      session
        ? getSessionDebugAgentSnapshots(session, liveAgentSnapshots)
        : [],
    [liveAgentSnapshots, session],
  );
  const toolCalls = useMemo(
    () =>
      session
        ? getSessionDebugToolCalls(session, agentProgressById)
        : [],
    [agentProgressById, session],
  );
  const availableTools = useMemo(
    () => getAvailableToolDebugInfo(tools, toolRenderers),
    [toolRenderers, tools],
  );

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
      <div className="border-border flex items-center gap-2 border-b px-3 py-2">
        <BugIcon className="text-muted-foreground h-4 w-4" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{summary.name}</div>
          <div className="text-muted-foreground truncate text-xs">
            {summary.sessionId}
          </div>
        </div>
        <StatusPill tone={summary.isRunning ? 'warn' : 'ok'}>
          {summary.isRunning ? 'running' : 'idle'}
        </StatusPill>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <Accordion
          type="multiple"
          defaultValue={defaultExpandedSections}
          className="w-full"
        >
          <AccordionItem value="summary">
            <AccordionTrigger className="px-3 py-2 text-sm">
              Summary
            </AccordionTrigger>
            <AccordionContent className="px-3 pb-3">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <KeyValue label="Provider" value={summary.modelProvider} />
                <KeyValue label="Model" value={summary.model} />
                <KeyValue
                  label="Custom model"
                  value={summary.customModelName ?? 'n/a'}
                />
                <KeyValue label="Base URL" value={summary.baseUrl ?? 'n/a'} />
                <KeyValue
                  label="Created"
                  value={formatDate(summary.createdAt)}
                />
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
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="tools">
            <AccordionTrigger className="px-3 py-2 text-sm">
              Available Tools
            </AccordionTrigger>
            <AccordionContent className="px-3 pb-3">
              {availableTools.length === 0 ? (
                <EmptyState>No tools registered.</EmptyState>
              ) : (
                <div className="flex flex-col gap-2">
                  {availableTools.map((tool) => (
                    <div
                      key={tool.name}
                      className="border-border rounded-md border px-2 py-1.5"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-xs font-medium">
                          {tool.name}
                        </span>
                        <div className="ml-auto flex gap-1">
                          <StatusPill tone={tool.hasExecute ? 'ok' : undefined}>
                            {tool.hasExecute ? 'execute' : 'no execute'}
                          </StatusPill>
                          <StatusPill tone={tool.hasRenderer ? 'ok' : undefined}>
                            {tool.hasRenderer ? 'renderer' : 'no renderer'}
                          </StatusPill>
                        </div>
                      </div>
                      {tool.description && (
                        <div className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                          {tool.description}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="context">
            <AccordionTrigger className="px-3 py-2 text-sm">
              Run Context
            </AccordionTrigger>
            <AccordionContent className="px-3 pb-3">
              <DebugJsonBlock
                title="session.runContext"
                value={session.runContext ?? null}
                defaultOpen
                editorClassName="h-56"
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="messages">
            <AccordionTrigger className="px-3 py-2 text-sm">
              Messages
            </AccordionTrigger>
            <AccordionContent className="px-3 pb-3">
              {messages.length === 0 ? (
                <EmptyState>No messages recorded.</EmptyState>
              ) : (
                <div className="flex flex-col gap-2">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className="border-border rounded-md border p-2"
                    >
                      <div className="mb-2 flex min-w-0 items-center gap-2">
                        <StatusPill>{message.role}</StatusPill>
                        <span className="truncate text-xs font-medium">
                          #{message.index} {message.id}
                        </span>
                        <span className="text-muted-foreground ml-auto text-[11px]">
                          {message.partCount} parts
                        </span>
                      </div>
                      {message.textPreview && (
                        <div className="text-muted-foreground mb-2 line-clamp-2 text-xs">
                          {message.textPreview}
                        </div>
                      )}
                      <DebugJsonBlock title="Raw message" value={message.raw} />
                    </div>
                  ))}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="tool-calls">
            <AccordionTrigger className="px-3 py-2 text-sm">
              Tool Calls
            </AccordionTrigger>
            <AccordionContent className="px-3 pb-3">
              {toolCalls.length === 0 ? (
                <EmptyState>No tool calls recorded.</EmptyState>
              ) : (
                <div className="flex flex-col gap-2">
                  {toolCalls.map((toolCall) => (
                    <div
                      key={`${toolCall.messageId}:${toolCall.partIndex}`}
                      className="border-border rounded-md border p-2"
                    >
                      <div className="mb-2 flex min-w-0 items-center gap-2">
                        <StatusPill
                          tone={
                            toolCall.state === 'output-available'
                              ? 'ok'
                              : toolCall.state === 'input-available' ||
                                  toolCall.state === 'approval-requested'
                                ? 'warn'
                                : undefined
                          }
                        >
                          {toolCall.state ?? 'unknown'}
                        </StatusPill>
                        <span className="truncate text-xs font-medium">
                          {toolCall.toolName}
                        </span>
                        <span className="text-muted-foreground ml-auto truncate text-[11px]">
                          {toolCall.toolCallId}
                        </span>
                      </div>
                      <div className="text-muted-foreground mb-2 grid grid-cols-2 gap-2 text-[11px]">
                        <span>message #{toolCall.messageIndex}</span>
                        <span>part #{toolCall.partIndex}</span>
                        <span>{toolCall.role}</span>
                        <span>
                          timing:{' '}
                          {toolTimings[toolCall.toolCallId]?.completedAt
                            ? `${toolTimings[toolCall.toolCallId]!.completedAt! - toolTimings[toolCall.toolCallId]!.startedAt}ms`
                            : 'n/a'}
                        </span>
                      </div>
                      <div className="grid gap-2">
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
                        {toolCall.hasAgentProgress && (
                          <StatusPill tone="warn">agent progress available</StatusPill>
                        )}
                        <DebugJsonBlock title="Raw tool part" value={toolCall.raw} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="agent-work">
            <AccordionTrigger className="px-3 py-2 text-sm">
              Agent Work
            </AccordionTrigger>
            <AccordionContent className="px-3 pb-3">
              {agentProgress.length === 0 ? (
                <EmptyState>No nested agent progress recorded.</EmptyState>
              ) : (
                <div className="flex flex-col gap-3">
                  {agentProgress.map((entry) => (
                    <div
                      key={entry.parentToolCallId}
                      className="border-border bg-muted/20 rounded-md border p-2"
                    >
                      <div className="mb-2 flex min-w-0 items-center gap-2">
                        <StatusPill
                          tone={entry.source === 'live' ? 'warn' : undefined}
                        >
                          {entry.source}
                        </StatusPill>
                        <span className="truncate text-xs font-medium">
                          parent {entry.parentToolCallId}
                        </span>
                      </div>
                      <AgentToolCallTree toolCalls={entry.toolCalls} />
                    </div>
                  ))}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="agent-snapshots">
            <AccordionTrigger className="px-3 py-2 text-sm">
              Agent Snapshots
            </AccordionTrigger>
            <AccordionContent className="px-3 pb-3">
              {agentSnapshots.length === 0 ? (
                <EmptyState>No agent snapshots captured.</EmptyState>
              ) : (
                <div className="flex flex-col gap-2">
                  {agentSnapshots.map((entry) => (
                    <div
                      key={entry.parentToolCallId}
                      className="border-border rounded-md border p-2"
                    >
                      <div className="mb-2 flex min-w-0 items-center gap-2">
                        <StatusPill
                          tone={entry.source === 'live' ? 'warn' : undefined}
                        >
                          {entry.source}
                        </StatusPill>
                        <span className="truncate text-xs font-medium">
                          {entry.snapshot.agentName ?? entry.parentToolCallId}
                        </span>
                        <span className="text-muted-foreground ml-auto truncate text-[11px]">
                          {entry.parentToolCallId}
                        </span>
                      </div>
                      {entry.snapshot.availableTools.length > 0 && (
                        <div className="mb-2 flex flex-wrap gap-1">
                          {entry.snapshot.availableTools.map((tool) => (
                            <StatusPill key={tool.name}>
                              {tool.name}
                            </StatusPill>
                          ))}
                        </div>
                      )}
                      <DebugJsonBlock
                        title="Agent snapshot"
                        value={entry.snapshot}
                      />
                    </div>
                  ))}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="raw-session">
            <AccordionTrigger className="px-3 py-2 text-sm">
              Raw Session JSON
            </AccordionTrigger>
            <AccordionContent className="px-3 pb-3">
              <DebugJsonBlock
                title="Session"
                value={session}
                defaultOpen
                editorClassName="h-80"
              />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
};
