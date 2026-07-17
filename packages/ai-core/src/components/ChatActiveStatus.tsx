import {cn} from '@sqlrooms/ui';
import type {UIMessage, UIMessagePart} from 'ai';
import {Loader2} from 'lucide-react';
import React, {type FC} from 'react';
import type {AgentToolCall} from '../types';
import {useElapsedTime} from '../hooks/useElapsedTime';
import type {ToolRenderBehavior} from './FlatAgentRenderer';
import {useToolRenderBehavior} from './FlatAgentRenderer';

type AnyUIMessagePart = UIMessagePart<any, any>;

/** User-facing description of the chat run's current active step. */
export type ChatActiveStatusInfo = {
  key: string;
  label: string;
  kind: 'tool' | 'approval' | 'model';
};

/**
 * Derives the current user-facing activity from the latest chat turn.
 * Tool labels honor `toolRenderBehavior` before falling back to a humanized
 * tool name.
 */
export function getChatActiveStatus(
  messages: UIMessage[] | undefined,
  behavior: ToolRenderBehavior = {},
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
export const ChatActiveStatus: FC<{
  messages: UIMessage[] | undefined;
  className?: string;
}> = ({messages, className}) => {
  const behavior = useToolRenderBehavior();
  const status = getChatActiveStatus(messages, behavior);

  return (
    <ChatActiveStatusLine
      key={status.key}
      status={status}
      className={className}
    />
  );
};

const ChatActiveStatusLine: FC<{
  status: ChatActiveStatusInfo;
  className?: string;
}> = ({status, className}) => {
  const [startedAt] = React.useState(() => Date.now());
  const elapsed = useElapsedTime(true, startedAt);

  return (
    <div
      className={cn(
        'text-muted-foreground flex items-center gap-2 text-sm',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
      <span>{status.label}</span>
      {elapsed && (
        <span
          className="text-muted-foreground/60 text-xs tabular-nums"
          aria-hidden="true"
        >
          {elapsed}
        </span>
      )}
    </div>
  );
};

function getCurrentTurnMessages(
  messages: UIMessage[] | undefined,
): UIMessage[] {
  if (!messages?.length) return [];
  for (let index = messages.length - 1; index >= 0; index--) {
    if (messages[index]?.role === 'user') return messages.slice(index);
  }
  return messages;
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
    return Boolean((part as {reasoning?: string}).reasoning?.trim());
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

/** Returns whether any tool in the current turn is awaiting approval. */
export function hasPendingToolApproval(
  messages: UIMessage[] | undefined,
): boolean {
  return getCurrentTurnMessages(messages).some(
    (message) =>
      message.role === 'assistant' &&
      (message.parts ?? []).some(
        (part) =>
          isToolPart(part) &&
          (part as {state?: string}).state === 'approval-requested',
      ),
  );
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
