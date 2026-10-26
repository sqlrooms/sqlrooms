import {Button, cn, ScrollArea, ScrollBar} from '@sqlrooms/ui';
import type {UIMessage, UIMessagePart} from 'ai';
import {ChevronDown} from 'lucide-react';
import {useRef, type FC, type ReactNode} from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {useScrollToBottom} from '../hooks/useScrollToBottom';
import type {AgentToolCall} from '../types';
import {isDynamicToolPart, isToolPart} from '../utils';
import {getChatActiveStatus} from './ChatActiveStatus';
import {useChatRenderingComponents} from './ChatRenderingContext';
import {useToolRenderBehavior} from './FlatAgentRenderer';
import {useChatRuntime} from './ChatRuntimeContext';
import {ChatAttachmentPreview} from './ChatAttachmentPreview';
import type {ChatAttachmentPart} from '../chatAttachments';

export type LocalAgentChatMessagesProps = {
  className?: string;
  /** Optional details inside the shared tool activity disclosure. */
  renderToolDetails?: (call: AgentToolCall) => ReactNode;
};

export const LocalAgentChatMessages: FC<LocalAgentChatMessagesProps> = ({
  className,
  renderToolDetails,
}) => {
  const runtime = useChatRuntime();
  const toolRenderBehavior = useToolRenderBehavior();
  const activeStatus =
    runtime.mode === 'harness-run' && runtime.pendingApprovals.length
      ? {
          key: 'harness-approval',
          label: 'Waiting for owner approval',
          kind: 'approval' as const,
        }
      : runtime.mode !== 'session'
        ? getChatActiveStatus(runtime.messages, toolRenderBehavior)
        : undefined;
  const ActiveStatus = useChatRenderingComponents().ActiveStatus;
  const containerRef = useRef<HTMLDivElement>(null);
  const {showScrollButton, scrollToBottom} = useScrollToBottom({
    containerRef,
    dataToObserve: runtime.mode !== 'session' ? runtime.messages : null,
    scrollOnInitialLoad: true,
  });

  if (runtime.mode === 'session') return null;

  return (
    <div className={cn('relative flex h-full w-full flex-col', className)}>
      <ScrollArea viewportRef={containerRef} className="min-h-0 flex-1">
        <div className="flex flex-col gap-3 p-3">
          {runtime.messages.map((message) => (
            <LocalAgentMessageView
              key={message.id}
              message={message}
              renderToolDetails={renderToolDetails}
            />
          ))}
          {/* An approval pauses the runtime, so `isStreaming` is false while
              the run is very much unfinished — keep reporting it. */}
          {activeStatus &&
            (runtime.isStreaming || activeStatus.kind === 'approval') && (
              <ActiveStatus status={activeStatus} className="px-1" />
            )}
          <div className="h-4 w-full shrink-0" />
        </div>
        <ScrollBar orientation="vertical" />
      </ScrollArea>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center">
        <Button
          type="button"
          onClick={scrollToBottom}
          className={cn(
            'pointer-events-auto z-50 mb-3 translate-y-4 rounded-full p-2 opacity-0 shadow-md transition-all duration-200',
            showScrollButton && 'translate-y-0 opacity-100',
          )}
          aria-label="Scroll to bottom"
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

const LocalAgentMessageView: FC<{
  message: UIMessage;
  renderToolDetails?: LocalAgentChatMessagesProps['renderToolDetails'];
}> = ({message, renderToolDetails}) => {
  const isUser = message.role === 'user';
  const parts = message.parts as UIMessagePart<any, any>[] | undefined;
  if (!parts || parts.length === 0) return null;

  return (
    <div
      className={cn(
        'flex w-full flex-col gap-1.5',
        isUser ? 'items-end' : 'items-start',
      )}
    >
      {parts.map((part, idx) => (
        <LocalAgentMessagePart
          key={`${message.id}-${idx}`}
          part={part}
          role={message.role}
          renderToolDetails={renderToolDetails}
        />
      ))}
    </div>
  );
};

const LocalAgentMessagePart: FC<{
  part: UIMessagePart<any, any>;
  role: UIMessage['role'];
  renderToolDetails?: LocalAgentChatMessagesProps['renderToolDetails'];
}> = ({part, role, renderToolDetails}) => {
  const type = (part as {type?: string}).type ?? '';

  if (type === 'text') {
    return <TextPart text={(part as {text?: string}).text ?? ''} role={role} />;
  }
  if (type === 'reasoning') {
    return <ReasoningPart text={(part as {text?: string}).text ?? ''} />;
  }
  if (type === 'file') {
    return (
      <div className="bg-muted max-w-[75%] rounded-md border p-2">
        <ChatAttachmentPreview attachment={part as ChatAttachmentPart} />
      </div>
    );
  }
  if (type === 'dynamic-tool' || type.startsWith('tool-')) {
    return (
      <LocalAgentToolActivityLine
        part={part}
        renderToolDetails={renderToolDetails}
      />
    );
  }
  return null;
};

const TextPart: FC<{text: string; role: UIMessage['role']}> = ({
  text,
  role,
}) => {
  const isUser = role === 'user';
  const runtime = useChatRuntime();
  return (
    <div
      className={cn(
        'rounded-md px-3 py-2 text-sm',
        isUser
          ? 'bg-primary text-primary-foreground max-w-[75%]'
          : 'bg-muted text-foreground max-w-none',
      )}
    >
      {isUser ? (
        <span className="whitespace-pre-wrap">{text}</span>
      ) : (
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={
              runtime.mode === 'harness-run' ? {img: () => null} : undefined
            }
          >
            {text}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
};

const ReasoningPart: FC<{text: string}> = ({text}) => {
  if (!text.trim()) return null;
  return (
    <div className="text-muted-foreground max-w-[85%] px-1 text-xs italic">
      {text}
    </div>
  );
};

const LocalAgentToolActivityLine: FC<{
  part: UIMessagePart<any, any>;
  renderToolDetails?: LocalAgentChatMessagesProps['renderToolDetails'];
}> = ({part, renderToolDetails}) => {
  const toolCall = partToAgentToolCall(part);
  const label = useToolLabel(toolCall);
  if (!toolCall) return null;

  const line = (
    <div
      className={cn(
        'border-border bg-muted/40 text-muted-foreground flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs',
        toolCall.state === 'error' && 'text-destructive border-destructive/40',
      )}
    >
      {renderToolDetails && (
        <ChevronDown className="h-3 w-3 -rotate-90 transition-transform group-open:rotate-0" />
      )}
      <StatusDot state={toolCall.state} />
      <span className="truncate">{label}</span>
      {renderToolDetails && <span>{toolCall.state}</span>}
    </div>
  );
  return renderToolDetails ? (
    <details className="group w-full min-w-0">
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        {line}
      </summary>
      {renderToolDetails(toolCall)}
    </details>
  ) : (
    line
  );
};

const StatusDot: FC<{state: AgentToolCall['state']}> = ({state}) => (
  <span
    className={cn(
      'inline-block h-1.5 w-1.5 shrink-0 rounded-full',
      state === 'pending' && 'animate-pulse bg-amber-500',
      state === 'success' && 'bg-emerald-500',
      state === 'error' && 'bg-destructive',
      state === 'approval-requested' && 'bg-blue-500',
    )}
  />
);

function useToolLabel(toolCall: AgentToolCall | null): string {
  const behavior = useToolRenderBehavior();
  if (!toolCall) return '';
  const custom =
    behavior.getActivityLabel?.(toolCall) ??
    behavior.getToolDisplayName?.(toolCall);
  if (custom) return custom;
  if (toolCall.state === 'pending') return toolCall.toolName;
  return toolCall.toolName;
}

function partToAgentToolCall(
  part: UIMessagePart<any, any>,
): AgentToolCall | null {
  if (!isToolPart(part) && !isDynamicToolPart(part)) return null;

  const toolCallId = part.toolCallId;
  if (!toolCallId) return null;

  const toolName = isDynamicToolPart(part)
    ? (part.toolName ?? 'tool')
    : part.type.replace(/^tool-/, '') || 'tool';

  return {
    toolCallId,
    toolName,
    input: part.input,
    output: part.output,
    errorText: part.errorText,
    state: mapPartStateToToolCallState(part.state),
  };
}

function mapPartStateToToolCallState(
  partState: string | undefined,
): AgentToolCall['state'] {
  switch (partState) {
    case 'output-available':
      return 'success';
    case 'output-error':
    case 'output-denied':
      return 'error';
    case 'approval-requested':
      return 'approval-requested';
    default:
      return 'pending';
  }
}
