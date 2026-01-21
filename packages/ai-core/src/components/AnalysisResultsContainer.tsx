import {cn, ScrollArea, ScrollBar} from '@sqlrooms/ui';
import {ChevronDown} from 'lucide-react';
import React, {useEffect, useRef} from 'react';
import {Components} from 'react-markdown';
import {useStoreWithAi} from '../AiSlice';
import {useScrollToBottom} from '../hooks/useScrollToBottom';
import {AnalysisResult} from './AnalysisResult';
import {AiThinkingDots} from './AiThinkingDots';
import type {ErrorMessageComponentProps} from './ErrorMessage';

export const AnalysisResultsContainer: React.FC<{
  className?: string;
  enableReasoningBox?: boolean;
  customMarkdownComponents?: Partial<Components>;
  excludeFromGrouping?: string[];
  ErrorMessageComponent?: React.ComponentType<ErrorMessageComponentProps>;
}> = ({
  className,
  enableReasoningBox = false,
  customMarkdownComponents,
  excludeFromGrouping: excludeFromGrouping,
  ErrorMessageComponent,
}) => {
  const currentSession = useStoreWithAi((s) => s.ai.getCurrentSession());
  const sessionId = currentSession?.id;
  const isRunning = useStoreWithAi((s) =>
    sessionId ? s.ai.getIsRunning(sessionId) : false,
  );
  const currentAnalysisResults = useStoreWithAi((s) =>
    s.ai.getAnalysisResults(),
  );
  const uiMessages = useStoreWithAi(
    (s) => s.ai.getCurrentSession()?.uiMessages,
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const {showScrollButton, scrollToBottom} = useScrollToBottom({
    containerRef,
    endRef,
    dataToObserve: uiMessages,
  });

  // Scroll to bottom when analysis starts
  useEffect(() => {
    if (isRunning) {
      scrollToBottom();
    }
  }, [isRunning, scrollToBottom]);

  return (
    <div className={cn('relative flex h-full w-full flex-col', className)}>
      <ScrollArea
        viewportRef={containerRef}
        className="flex w-full flex-grow flex-col gap-5"
      >
        {/* Render analysis results */}
        {currentAnalysisResults?.map((analysisResult) => (
          <AnalysisResult
            key={analysisResult.id}
            analysisResult={analysisResult}
            enableReasoningBox={enableReasoningBox}
            customMarkdownComponents={customMarkdownComponents}
            excludeFromGrouping={excludeFromGrouping}
            ErrorMessageComponent={ErrorMessageComponent}
          />
        ))}
        {isRunning && (
          <AiThinkingDots className="text-muted-foreground p-4" />
        )}
        <div ref={endRef} className="h-10 w-full shrink-0" />
        <ScrollBar orientation="vertical" />
        <ScrollBar orientation="horizontal" />
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
