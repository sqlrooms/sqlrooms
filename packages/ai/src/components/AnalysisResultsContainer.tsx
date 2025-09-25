import {cn, ScrollArea, ScrollBar, SkeletonPane} from '@sqlrooms/ui';
import {ChevronDown} from 'lucide-react';
import React, {useRef, useMemo} from 'react';
import {useStoreWithAi} from '../AiSlice';
import {useScrollToBottom} from '../hooks/useScrollToBottom';
import {AnalysisResult} from './AnalysisResult';

export const AnalysisResultsContainer: React.FC<{
  className?: string;
}> = ({className}) => {
  const isRunningAnalysis = useStoreWithAi((s) => s.ai.isRunningAnalysis);
  const uiMessages = useStoreWithAi(
    (s) => s.ai.getCurrentSession()?.uiMessages,
  );
  const getAnalysisResults = useStoreWithAi((s) => s.ai.getAnalysisResults);
  const currentAnalysisResults = useStoreWithAi(
    (s) => s.ai.getCurrentSession()?.analysisResults,
  );

  // Memoize the analysis results to prevent infinite re-renders
  // We depend on uiMessages and currentAnalysisResults (error message) which is the actual data that changes
  const analysisResults = useMemo(() => {
    return getAnalysisResults();
  }, [uiMessages, currentAnalysisResults]);

  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const {showScrollButton, scrollToBottom} = useScrollToBottom({
    containerRef,
    endRef,
    dataToObserve: analysisResults,
  });

  return (
    <div className={cn('relative flex h-full w-full flex-col', className)}>
      <ScrollArea
        ref={containerRef}
        className="flex w-full flex-grow flex-col gap-5"
      >
        {/* Render analysis results */}
        {analysisResults.map((result) => (
          <AnalysisResult key={result.id} result={result} />
        ))}
        {isRunningAnalysis && <SkeletonPane className="p-4" />}
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
