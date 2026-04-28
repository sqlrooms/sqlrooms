import {useChat} from '@ai-sdk/react';
import type {ToolLoopAgent, UIMessage} from 'ai';
import {ScrollArea, ScrollBar, cn} from '@sqlrooms/ui';
import {useCallback, useEffect, useRef, useState, type FC} from 'react';
import {
  type ToolRenderBehavior,
  ToolRenderBehaviorProvider,
} from '../FlatAgentRenderer';
import {AiThinkingDots} from '../AiThinkingDots';
import {ChatInput} from './ChatInput';
import {MessageView} from './MessageView';
import {SuggestionStrip} from './SuggestionStrip';
import {useAgentChatTransport} from './useAgentChatTransport';
import {useStickyScroll} from './useStickyScroll';

export type AgentChatProps = {
  /**
   * A pre-constructed `ToolLoopAgent`. The caller owns the agent's model,
   * tools, system instructions, and provider options. `AgentChat` only
   * drives the request/response loop.
   */
  agent: ToolLoopAgent<any, any, any>;
  /**
   * Messages to seed the chat with. Defaults to an empty list. `AgentChat`
   * keeps message state locally; this prop is consulted only on mount.
   */
  initialMessages?: UIMessage[];
  /**
   * Optional prompt chips shown until the user sends their first message.
   */
  initialSuggestions?: string[];
  /**
   * Customize tool-call labels and structure. Mirrors the contract used by
   * the session-based `Chat` component.
   */
  toolRenderBehavior?: ToolRenderBehavior;
  /**
   * Notified whenever the message list changes (each stream delta). Hosts
   * that want to mirror messages elsewhere may use this; most callers don't
   * need it.
   */
  onMessagesChange?: (messages: UIMessage[]) => void;
  /**
   * Textarea placeholder. Defaults to a generic `"Message..."` so
   * `AgentChat` stays a domain-neutral primitive; callers supply
   * domain-specific copy.
   */
  placeholder?: string;
  className?: string;
};

/**
 * Minimal chat surface driven by an externally constructed `ToolLoopAgent`.
 * Unlike the session-based `Chat` component, `AgentChat` owns no session
 * state, no AI slice, no model selection, and no persistence — it is built
 * for transient, single-purpose agent conversations (authoring wizards,
 * inline approvals, one-shot queries).
 */
export const AgentChat: FC<AgentChatProps> = ({
  agent,
  initialMessages,
  initialSuggestions,
  toolRenderBehavior,
  onMessagesChange,
  placeholder = 'Message...',
  className,
}) => {
  const transport = useAgentChatTransport(agent);

  const {messages, sendMessage, status, stop} = useChat({
    transport,
    messages: initialMessages ?? [],
  });

  const isStreaming = status === 'streaming' || status === 'submitted';

  useMessagesObserver(messages, onMessagesChange);
  const scrollRef = useStickyScroll<HTMLDivElement>(messages);

  const [input, setInput] = useState('');

  const handleSend = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming) return;
      void sendMessage({text: trimmed});
      setInput('');
    },
    [isStreaming, sendMessage],
  );

  const showSuggestions =
    messages.length === 0 &&
    (initialSuggestions?.length ?? 0) > 0 &&
    !isStreaming;

  return (
    <ToolRenderBehaviorProvider value={toolRenderBehavior ?? EMPTY_BEHAVIOR}>
      <div className={cn('flex h-full w-full flex-col', className)}>
        <ScrollArea viewportRef={scrollRef} className="min-h-0 flex-1">
          <div className="flex flex-col gap-3 p-3">
            {messages.map((message) => (
              <MessageView key={message.id} message={message} />
            ))}
            {isStreaming && (
              <AiThinkingDots className="text-muted-foreground px-1" />
            )}
          </div>
          <ScrollBar orientation="vertical" />
        </ScrollArea>

        {showSuggestions && (
          <SuggestionStrip
            suggestions={initialSuggestions ?? []}
            onPick={handleSend}
          />
        )}

        <ChatInput
          value={input}
          onChange={setInput}
          onSend={handleSend}
          onStop={() => stop()}
          isStreaming={isStreaming}
          placeholder={placeholder}
        />
      </div>
    </ToolRenderBehaviorProvider>
  );
};

const EMPTY_BEHAVIOR: ToolRenderBehavior = {};

/**
 * Fire `onMessagesChange` on every message delta without re-subscribing when
 * the callback identity churns. Ref-guarded so hosts can pass inline
 * functions without triggering redundant calls.
 */
function useMessagesObserver(
  messages: UIMessage[],
  onMessagesChange: ((messages: UIMessage[]) => void) | undefined,
): void {
  const ref = useRef(onMessagesChange);
  useEffect(() => {
    ref.current = onMessagesChange;
  }, [onMessagesChange]);
  useEffect(() => {
    ref.current?.(messages);
  }, [messages]);
}
