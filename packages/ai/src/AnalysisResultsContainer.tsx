'use client';
import {cn, SkeletonPane} from '@sqlrooms/ui';
import {ChevronDown} from 'lucide-react';
import React from 'react';
import {useStoreWithAi} from './AiSlice';
import {AnalysisResult} from './AnalysisResult';
import {
  useScrollToBottom,
  useScrollToBottomButton,
} from './hooks/use-scroll-to-bottom';
import {TOOLS} from './analysis';

export const AnalysisResultsContainer: React.FC = () => {
  const isRunningAnalysis = useStoreWithAi((s) => s.ai.isRunningAnalysis);
  const currentSession = useStoreWithAi((s) => s.ai.getCurrentSession());
  const deleteAnalysisResult = useStoreWithAi((s) => s.ai.deleteAnalysisResult);
  const components = (Object.keys(TOOLS) as Array<keyof typeof TOOLS>).map(
    (tool) => ({
      toolName: tool,
      component: TOOLS[tool].component,
    }),
  );

  const [messagesContainerRef, messagesEndRef] =
    useScrollToBottom<HTMLDivElement>();
  const {showButton, scrollToBottom} =
    useScrollToBottomButton(messagesContainerRef);

  const onDeleteAnalysisResult = (id: string) => {
    if (currentSession) {
      deleteAnalysisResult(currentSession.id, id);
    }
  };

  return (
    <div className="flex flex-col relative h-full w-full overflow-auto p-1">
      {/* Only render the current session content */}
      {currentSession ? (
        <>
          <div
            className="flex flex-grow flex-col w-full gap-10 p-4 overflow-auto"
            ref={messagesContainerRef}
          >
            {currentSession.analysisResults.map((result) => (
              <AnalysisResult
                key={result.id}
                result={result}
                toolComponents={components}
                onDeleteAnalysisResult={onDeleteAnalysisResult}
              />
            ))}
            {isRunningAnalysis && <SkeletonPane className="p-4" />}
            <div className="h-20" />
            <div
              ref={messagesEndRef}
              className="shrink-0 min-w-[24px] min-h-[24px]"
            />
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center flex-grow p-8">
          <p className="text-muted-foreground">
            Select or create a session to get started.
          </p>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 pointer-events-none flex justify-center">
        <button
          onClick={scrollToBottom}
          className={cn(
            'pointer-events-auto bg-primary hover:bg-primary/90 text-primary-foreground z-50',
            'rounded-full p-2 shadow-md transition-all duration-200 opacity-0 translate-y-4 mb-6',
            showButton && 'opacity-100 translate-y-0',
          )}
          aria-label="Scroll to bottom"
        >
          <ChevronDown className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
