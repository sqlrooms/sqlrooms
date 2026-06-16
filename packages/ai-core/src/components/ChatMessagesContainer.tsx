import {cn, ScrollArea, ScrollBar} from '@sqlrooms/ui';
import {ChevronDown, SplitIcon} from 'lucide-react';
import type {UIMessage} from 'ai';
import React, {useEffect, useRef} from 'react';
import {Components} from 'react-markdown';
import {useStoreWithAi} from '../AiSlice';
import {useScrollToBottom} from '../hooks/useScrollToBottom';
import {ChatTurnView} from './ChatTurnView';
import {AiThinkingDots} from './AiThinkingDots';
import type {ErrorMessageComponentProps} from './ErrorMessage';
import {getChatTurnsFromUiMessages} from '../chatTurns';
import type {AiSessionForkOrigin, ChatSessionSchema} from '@sqlrooms/ai-config';

function ChatForkProvenance({
  forkOrigin,
  sourceSession,
  onSwitchToSource,
}: {
  forkOrigin: AiSessionForkOrigin;
  sourceSession?: ChatSessionSchema;
  onSwitchToSource: () => void;
}) {
  const sourceLabel = sourceSession?.name || forkOrigin.sourceSessionNameAtFork;

  return (
    <div className="text-muted-foreground my-4 flex items-center gap-3 text-sm">
      <div className="bg-border h-px min-w-8 flex-1" />
      <SplitIcon className="h-4 w-4 shrink-0 rotate-90" />
      {sourceSession ? (
        <button
          type="button"
          className="text-primary hover:text-primary/80 min-w-0 truncate underline-offset-4 hover:underline"
          onClick={onSwitchToSource}
        >
          Forked from {sourceLabel}
        </button>
      ) : (
        <span className="min-w-0 truncate">
          Forked from {sourceLabel || 'deleted conversation'}
        </span>
      )}
      <div className="bg-border h-px min-w-8 flex-1" />
    </div>
  );
}

export const ChatMessagesContainer: React.FC<{
  className?: string;
  customMarkdownComponents?: Partial<Components>;
  hoistedRenderers?: string[];
  ErrorMessageComponent?: React.ComponentType<ErrorMessageComponentProps>;
}> = ({
  className,
  customMarkdownComponents,
  hoistedRenderers,
  ErrorMessageComponent,
}) => {
  const currentSession = useStoreWithAi((s) => s.ai.getCurrentSession());
  const sessionId = currentSession?.id;
  const forkOrigin = useStoreWithAi((s) =>
    sessionId ? s.ai.getSessionForkOrigin(sessionId) : undefined,
  );
  const sessions = useStoreWithAi((s) => s.ai.config.sessions);
  const switchSession = useStoreWithAi((s) => s.ai.switchSession);
  const isRunning = useStoreWithAi((s) =>
    sessionId ? s.ai.getIsRunning(sessionId) : false,
  );
  const uiMessages = useStoreWithAi(
    (s) => s.ai.getCurrentSession()?.uiMessages,
  );
  const chatTurns = React.useMemo(
    () =>
      getChatTurnsFromUiMessages(uiMessages as UIMessage[] | undefined, {
        isRunning,
      }),
    [isRunning, uiMessages],
  );
  const sourceSession = React.useMemo(
    () =>
      forkOrigin
        ? sessions.find((session) => session.id === forkOrigin.sourceSessionId)
        : undefined,
    [forkOrigin, sessions],
  );
  const forkProvenanceTurnId = React.useMemo(() => {
    if (!forkOrigin || chatTurns.length === 0) return undefined;
    if (
      forkOrigin.sourceTurnId &&
      chatTurns.some((chatTurn) => chatTurn.id === forkOrigin.sourceTurnId)
    ) {
      return forkOrigin.sourceTurnId;
    }
    return chatTurns[chatTurns.length - 1]?.id;
  }, [chatTurns, forkOrigin]);

  const containerRef = useRef<HTMLDivElement>(null);
  const {showScrollButton, scrollToBottom} = useScrollToBottom({
    containerRef,
    dataToObserve: uiMessages,
  });

  // Scroll to bottom when analysis starts
  useEffect(() => {
    if (isRunning) {
      scrollToBottom();
    }
  }, [isRunning, scrollToBottom]);

  // Scroll to bottom when switching chat tabs (sessions)
  useEffect(() => {
    if (!sessionId) return;
    const container = containerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [sessionId]);

  return (
    <div className={cn('relative flex h-full w-full flex-col', className)}>
      <ScrollArea
        viewportRef={containerRef}
        className="flex w-full grow flex-col gap-5"
      >
        <div className="pr-3">
          {chatTurns.map((chatTurn) => (
            <React.Fragment key={chatTurn.id}>
              <ChatTurnView
                chatTurn={chatTurn}
                customMarkdownComponents={customMarkdownComponents}
                hoistedRenderers={hoistedRenderers}
                ErrorMessageComponent={ErrorMessageComponent}
              />
              {forkOrigin && forkProvenanceTurnId === chatTurn.id && (
                <ChatForkProvenance
                  forkOrigin={forkOrigin}
                  sourceSession={sourceSession}
                  onSwitchToSource={() => {
                    if (sourceSession) switchSession(sourceSession.id);
                  }}
                />
              )}
            </React.Fragment>
          ))}
          {isRunning && (
            <AiThinkingDots className="text-muted-foreground p-4" />
          )}
          <div className="h-10 w-full shrink-0" />
        </div>
        <ScrollBar orientation="vertical" />
      </ScrollArea>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center">
        <button
          onClick={scrollToBottom}
          className={cn(
            'bg-primary hover:bg-primary/90 text-primary-foreground pointer-events-auto z-50',
            'mb-6 translate-y-4 rounded-full p-2 opacity-0 shadow-md transition-all duration-200',
            showScrollButton && 'translate-y-0 opacity-100',
          )}
          aria-label="Scroll to bottom"
        >
          <ChevronDown className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};
