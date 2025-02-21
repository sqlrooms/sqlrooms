'use client';
import {cn, SkeletonPane} from '@sqlrooms/ui';
import {ChevronDown} from 'lucide-react';
import {useStoreWithAi} from './AiSlice';
import {AnalysisResult} from './AnalysisResult';
import {
  useScrollToBottom,
  useScrollToBottomButton,
} from './hooks/use-scroll-to-bottom';

export const AnalysisResultsContainer: React.FC = () => {
  const isRunningAnalysis = useStoreWithAi((s) => s.ai.isRunningAnalysis);
  const analysisResults = useStoreWithAi(
    (s) => s.project.config.ai.analysisResults,
  );
  const [messagesContainerRef, messagesEndRef] =
    useScrollToBottom<HTMLDivElement>();
  const {showButton, scrollToBottom} =
    useScrollToBottomButton(messagesContainerRef);

  return (
    <div className="flex relative h-full w-full overflow-hidden">
      <div
        className="flex flex-grow flex-col w-full gap-10 p-4 overflow-auto"
        ref={messagesContainerRef}
      >
        {analysisResults.map((result) => (
          <AnalysisResult key={result.id} result={result} />
        ))}
        <div className="h-20" />
        {messagesEndRef && (
          <div
            ref={messagesEndRef}
            className="shrink-0 min-w-[24px] min-h-[24px]"
          />
        )}
        {isRunningAnalysis && <SkeletonPane className="p-4" />}
      </div>
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
