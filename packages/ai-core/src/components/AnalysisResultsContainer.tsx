import {cn, ScrollBar} from '@sqlrooms/ui';
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area';
import {ChevronDown} from 'lucide-react';
import React, {useRef} from 'react';
import {Components} from 'react-markdown';
import {useStoreWithAi} from '../AiSlice';
import {useScrollToBottom} from '../hooks/useScrollToBottom';
import {AnalysisResult} from './AnalysisResult';
import {AiThinkingDots} from './AiThinkingDots';

export const AnalysisResultsContainer: React.FC<{
  className?: string;
  enableReasoningBox?: boolean;
  customComponents?: Partial<Components>;
  userTools?: string[];
}> = ({className, enableReasoningBox = false, customComponents, userTools}) => {
  const isRunningAnalysis = useStoreWithAi((s) => s.ai.isRunningAnalysis);
  const currentAnalysisResults = useStoreWithAi((s) =>
    s.ai.getAnalysisResults(),
  );
  const uiMessages = useStoreWithAi((s) => s.ai.getCurrentSession()?.uiMessages || []);

  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const {showScrollButton, scrollToBottom} = useScrollToBottom({
    containerRef,
    endRef,
    dataToObserve: uiMessages,
  });

  return (
    <div className={cn('relative flex h-full w-full flex-col', className)}>
      <ScrollAreaPrimitive.Root className="relative h-full w-full overflow-hidden">
        <ScrollAreaPrimitive.Viewport
          ref={containerRef}
          className="h-full w-full rounded-[inherit] flex flex-col gap-5"
        >
        {/* Render analysis results */}
        {currentAnalysisResults.map((analysisResult) => (
          <AnalysisResult
            key={analysisResult.id}
            analysisResult={analysisResult}
            enableReasoningBox={enableReasoningBox}
            customComponents={customComponents}
            userTools={userTools}
          />
        ))}
        {isRunningAnalysis && (
          <AiThinkingDots className="text-muted-foreground p-4" />
        )}
        <div ref={endRef} className="h-10 w-full shrink-0" />
        </ScrollAreaPrimitive.Viewport>
        <ScrollBar orientation="vertical" />
        <ScrollBar orientation="horizontal" />
      </ScrollAreaPrimitive.Root>
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
