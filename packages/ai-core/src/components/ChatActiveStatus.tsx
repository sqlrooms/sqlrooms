import {cn} from '@sqlrooms/ui';
import {PauseIcon} from 'lucide-react';
import type {UIMessage, UIMessagePart} from 'ai';
import React, {type FC} from 'react';
import type {AgentToolCall} from '../types';
import {AiThinkingDots} from './AiThinkingDots';
import {areAnyNestedAwaitingApproval} from './buildChatTurnModel';
import type {ToolRenderBehavior} from './FlatAgentRenderer';
import type {
  ChatActiveStatusInfo,
  ChatActiveStatusProps,
} from './ChatRenderingTypes';

export {hasPendingToolApproval} from '../timeouts';

type AnyUIMessagePart = UIMessagePart<any, any>;

/**
 * Derives the current user-facing activity from the latest chat turn.
 * Tool labels honor `toolRenderBehavior` before falling back to a humanized
 * tool name.
 */
export function getChatActiveStatus(
  messages: UIMessage[] | undefined,
  behavior: ToolRenderBehavior = {},
  agentProgress: Record<string, AgentToolCall[]> = {},
): ChatActiveStatusInfo {
  const currentTurnMessages = getCurrentTurnMessages(messages);
  const activeTool = findLastActiveTool(currentTurnMessages);

  if (activeTool?.state === 'approval-requested') {
    return {
      key: `approval:${activeTool.toolCallId}`,
      label: 'Waiting for approval…',
      kind: 'approval',
    };
  }

  // An approval raised inside a nested agent pauses the run just as much, but
  // the part that holds it is the agent call, which still looks like a tool in
  // progress. Without this the status would animate a run that is waiting.
  const nestedApprovalOwner = findNestedApprovalOwner(
    currentTurnMessages,
    agentProgress,
  );
  if (nestedApprovalOwner) {
    return {
      key: `approval:${nestedApprovalOwner}`,
      label: 'Waiting for approval…',
      kind: 'approval',
    };
  }

  if (activeTool) {
    return {
      key: `tool:${activeTool.toolCallId}`,
      label: getActiveToolLabel(activeTool, behavior),
      kind: 'tool',
    };
  }

  const isContinuing = currentTurnMessages.some(
    (message) =>
      message.role === 'assistant' &&
      (message.parts?.some(hasVisibleProgress) ?? false),
  );

  return isContinuing
    ? {
        key: 'model:continuing',
        label: 'Continuing analysis…',
        kind: 'model',
      }
    : {
        key: 'model:waiting',
        label: 'Waiting for model…',
        kind: 'model',
      };
}

/** Displays the current chat activity and elapsed time for that step. */
export const ChatActiveStatus: FC<ChatActiveStatusProps> = ({
  status,
  className,
}) => (
  <ChatActiveStatusLine
    key={status.key}
    status={status}
    className={className}
  />
);

const ChatActiveStatusLine: FC<{
  status: ChatActiveStatusInfo;
  className?: string;
}> = ({status, className}) => (
  <div
    className={cn('text-muted-foreground flex items-center', className)}
    role="status"
    aria-live="polite"
  >
    {status.kind === 'approval' ? (
      // An approval stops the run until the user acts, so it is named rather
      // than animated: the dots would read as work still in progress.
      <>
        <PauseIcon className="size-3.5 shrink-0" aria-hidden />
        {/* The visible copy is short; assistive tech gets the actionable
            state instead of reading both. */}
        <span className="ml-1.5 text-xs" aria-hidden>
          Paused…
        </span>
        <span className="sr-only">{status.label}</span>
      </>
    ) : (
      <>
        <AiThinkingDots />
        <span className="sr-only">{status.label}</span>
      </>
    )}
  </div>
);

function getCurrentTurnMessages(
  messages: UIMessage[] | undefined,
): UIMessage[] {
  if (!messages?.length) return [];
  for (let index = messages.length - 1; index >= 0; index--) {
    if (messages[index]?.role === 'user') return messages.slice(index);
  }
  return messages;
}

/** Tool call id of the nested-agent part whose subtree awaits an approval. */
function findNestedApprovalOwner(
  messages: UIMessage[],
  agentProgress: Record<string, AgentToolCall[]>,
): string | undefined {
  for (const message of messages) {
    if (message.role !== 'assistant') continue;
    for (const part of message.parts ?? []) {
      if (!isToolPart(part)) continue;
      const toolCallId = (part as {toolCallId?: string}).toolCallId;
      const nested = toolCallId ? agentProgress[toolCallId] : undefined;
      if (nested && areAnyNestedAwaitingApproval(nested, agentProgress)) {
        return toolCallId;
      }
    }
  }
  return undefined;
}

function findLastActiveTool(messages: UIMessage[]): AgentToolCall | undefined {
  for (
    let messageIndex = messages.length - 1;
    messageIndex >= 0;
    messageIndex--
  ) {
    const message = messages[messageIndex];
    if (message?.role !== 'assistant') continue;
    const parts = message.parts ?? [];
    for (let partIndex = parts.length - 1; partIndex >= 0; partIndex--) {
      const toolCall = partToActiveToolCall(parts[partIndex]);
      if (toolCall) return toolCall;
    }
  }
  return undefined;
}

function partToActiveToolCall(
  part: AnyUIMessagePart | undefined,
): AgentToolCall | undefined {
  if (!part || !isToolPart(part)) return undefined;
  const state = (part as {state?: string}).state;
  if (
    state !== 'input-streaming' &&
    state !== 'input-available' &&
    state !== 'approval-requested'
  ) {
    return undefined;
  }

  const typedPart = part as AnyUIMessagePart & {
    toolCallId?: string;
    toolName?: string;
    input?: unknown;
  };
  if (!typedPart.toolCallId) return undefined;

  return {
    toolCallId: typedPart.toolCallId,
    toolName:
      typedPart.type === 'dynamic-tool'
        ? typedPart.toolName || 'tool'
        : typedPart.type.replace(/^tool-/, '') || 'tool',
    input: typedPart.input,
    state: state === 'approval-requested' ? 'approval-requested' : 'pending',
  };
}

function isToolPart(part: AnyUIMessagePart): boolean {
  return part.type === 'dynamic-tool' || part.type.startsWith('tool-');
}

function hasVisibleProgress(part: AnyUIMessagePart): boolean {
  if (part.type === 'text') {
    return Boolean((part as {text?: string}).text?.trim());
  }
  if (part.type === 'reasoning') {
    return Boolean((part as {text?: string}).text?.trim());
  }
  if (isToolPart(part)) {
    const state = (part as {state?: string}).state;
    return (
      state === 'output-available' ||
      state === 'output-error' ||
      state === 'output-denied' ||
      state === 'approval-responded'
    );
  }
  return false;
}

function getActiveToolLabel(
  toolCall: AgentToolCall,
  behavior: ToolRenderBehavior,
): string {
  const activityLabel = behavior.getActivityLabel?.(toolCall);
  if (activityLabel) return withEllipsis(activityLabel);

  const displayName = behavior.getToolDisplayName?.(toolCall);
  if (displayName) return withEllipsis(`Running ${displayName}`);

  const normalized = toolCall.toolName.toLowerCase();
  if (normalized.includes('command')) return 'Executing command…';
  if (normalized.includes('chart') || normalized.includes('visual')) {
    return 'Creating chart…';
  }
  if (normalized.includes('query') || normalized.includes('sql')) {
    return 'Running query…';
  }
  return withEllipsis(`Running ${humanizeToolName(toolCall.toolName)}`);
}

function humanizeToolName(toolName: string): string {
  return (
    toolName
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[-_.]+/g, ' ')
      .trim()
      .toLowerCase() || 'tool'
  );
}

function withEllipsis(label: string): string {
  return /[….!?]$/.test(label) ? label : `${label}…`;
}
