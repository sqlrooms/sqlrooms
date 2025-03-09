'use client';
import {cn, SkeletonPane} from '@sqlrooms/ui';
import {ChevronDown} from 'lucide-react';
import React, {useMemo, useRef} from 'react';
import {useStoreWithAi} from '../AiSlice';
import {TOOLS} from '../analysis';
import {AnalysisResult} from './AnalysisResult';
import {useScrollToBottom} from '../hooks/useScrollToBottom';

export const AnalysisResultsContainer: React.FC<{
  className?: string;
}> = ({className}) => {
  const isRunningAnalysis = useStoreWithAi((s) => s.ai.isRunningAnalysis);
  const currentSession = useStoreWithAi((s) => s.ai.getCurrentSession());
  const deleteAnalysisResult = useStoreWithAi((s) => s.ai.deleteAnalysisResult);
  const toolComponents = useMemo(
    () =>
      (Object.keys(TOOLS) as Array<keyof typeof TOOLS>).map((tool) => ({
        toolName: tool,
        component: TOOLS[tool].component,
      })),
    [],
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const {showScrollButton, scrollToBottom} = useScrollToBottom({
    containerRef,
    endRef,
    dataToObserve: currentSession?.analysisResults,
  });

  const onDeleteAnalysisResult = (id: string) => {
    if (currentSession) {
      deleteAnalysisResult(currentSession.id, id);
    }
  };

  return (
    <div className={cn('relative flex h-full w-full flex-col', className)}>
      <div
        ref={containerRef}
        className="flex w-full flex-grow flex-col gap-5 overflow-auto"
      >
        {currentSession?.analysisResults.map((result) => (
          <AnalysisResult
            key={result.id}
            result={result}
            toolComponents={toolComponents}
            onDeleteAnalysisResult={onDeleteAnalysisResult}
          />
        ))}
        {isRunningAnalysis && <SkeletonPane className="p-4" />}
        <div ref={endRef} className="h-10 w-full shrink-0" />
      </div>
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
