import {cn, ScrollArea, ScrollBar, Button, CopyButton} from '@sqlrooms/ui';
import {ChevronDown, SquareTerminalIcon, TrashIcon} from 'lucide-react';
import React, {useEffect, useRef, useState} from 'react';
import {useStoreWithAi} from '../AiSlice';
import {useScrollToBottom} from '../hooks/useScrollToBottom';
import {AnalysisResult} from './AnalysisResult';
import {AiThinkingDots} from './AiThinkingDots';
import {DeleteConfirmationDialog} from './DeleteConfirmationDialog';

export const AnalysisResultsContainer: React.FC<{
  className?: string;
}> = ({className}) => {
  const isRunningAnalysis = useStoreWithAi((s) => s.ai.isRunningAnalysis);
  const currentAnalysisResults = useStoreWithAi((s) =>
    s.ai.getAnalysisResults(),
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const {showScrollButton, scrollToBottom} = useScrollToBottom({
    containerRef,
    endRef,
    dataToObserve: currentAnalysisResults,
  });

  const [floatingPromptId, setFloatingPromptId] = useState<string | null>(null);

  return (
    <div className={cn('relative flex h-full w-full flex-col', className)}>
      <ScrollArea
        ref={containerRef}
        className="flex h-full w-full flex-grow flex-col gap-5 overflow-auto"
      >
        {/* Render analysis results */}
        {currentAnalysisResults.map((analysisResult) => (
          <AnalysisResult
            key={analysisResult.id}
            analysisResult={analysisResult}
            floatingPromptId={floatingPromptId}
          />
        ))}
        {isRunningAnalysis && (
          <AiThinkingDots className="text-muted-foreground p-4" />
        )}
        <div ref={endRef} className="h-10 w-full shrink-0" />
        <ScrollBar orientation="vertical" />
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      {/* Floating prompt overlay */}
      <FloatingPromptOverlay
        rootRef={containerRef}
        onActivePromptChange={setFloatingPromptId}
      />
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

const FloatingPromptOverlay: React.FC<{
  rootRef: React.RefObject<HTMLDivElement | null>;
  onActivePromptChange: (id: string | null) => void;
}> = ({rootRef, onActivePromptChange}) => {
  const [activePrompt, setActivePrompt] = useState<{
    id: string;
    text: string;
  } | null>(null);

  const currentSession = useStoreWithAi((s) => s.ai.getCurrentSession());
  const deleteAnalysisResult = useStoreWithAi((s) => s.ai.deleteAnalysisResult);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

  useEffect(() => {
    const rootEl = rootRef.current;
    if (!rootEl) return;

    const viewport = rootEl.querySelector<HTMLElement>(
      '[data-radix-scroll-area-viewport]',
    );
    if (!viewport) return;

    const headers = () =>
      Array.from(
        viewport.querySelectorAll<HTMLElement>('[data-prompt-header]'),
      );

    const computeActive = () => {
      const vRect = viewport.getBoundingClientRect();
      const items = headers();
      let current: {id: string; text: string} | null = null;
      for (const el of items) {
        const rect = el.getBoundingClientRect();
        const offsetTop = rect.top - vRect.top;
        if (offsetTop <= 0) {
          const id = el.dataset.resultId;
          const text = el.dataset.promptText;
          if (id && text) {
            current = {id, text};
          }
        } else {
          break;
        }
      }
      setActivePrompt(current);
      onActivePromptChange(current?.id || null);
    };

    computeActive();
    const onScroll = () => computeActive();
    viewport.addEventListener('scroll', onScroll, {passive: true});

    const ro = new ResizeObserver(() => computeActive());
    ro.observe(viewport);

    return () => {
      viewport.removeEventListener('scroll', onScroll);
      ro.disconnect();
    };
  }, [rootRef, onActivePromptChange]);

  if (!activePrompt) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex justify-stretch">
      <div className="bg-muted/95 text-foreground group mx-2 mt-2 flex max-h-32 w-full items-start gap-2 rounded-md border p-2 text-sm shadow-md backdrop-blur-sm">
        <SquareTerminalIcon className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="flex-1 overflow-y-auto pr-1">{activePrompt.text}</div>
        <div className="pointer-events-auto flex shrink-0 gap-2 opacity-0 transition-opacity group-hover:opacity-100">
          <CopyButton
            text={activePrompt.text}
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            ariaLabel="Copy prompt"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setShowDeleteConfirmation(true)}
          >
            <TrashIcon className="h-4 w-4" />
          </Button>
        </div>

        <DeleteConfirmationDialog
          open={showDeleteConfirmation}
          onOpenChange={setShowDeleteConfirmation}
          onConfirm={() => {
            if (currentSession?.id) {
              deleteAnalysisResult(currentSession.id, activePrompt.id);
            }
            setShowDeleteConfirmation(false);
          }}
          canConfirm={Boolean(currentSession?.id)}
          contentClassName="pointer-events-auto sm:max-w-[425px]"
        />
      </div>
    </div>
  );
};
