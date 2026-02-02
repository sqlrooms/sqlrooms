import {
  cn,
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  Spinner,
} from '@sqlrooms/ui';
import {ChevronLeft, ChevronRight, Lightbulb, X} from 'lucide-react';
import {
  PropsWithChildren,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {useStoreWithAi} from '../AiSlice';
import {truncate} from '@sqlrooms/utils';

type PromptSuggestionsContainerProps = PropsWithChildren<{
  isLoading?: boolean;
  className?: string;
}>;

/**
 * Container component for prompt suggestions
 * Shows suggestions when visible, returns null when not visible
 */
const Container: React.FC<PromptSuggestionsContainerProps> = ({
  isLoading = false,
  className,
  children,
}) => {
  const isVisible = useStoreWithAi((s) => s.ai.promptSuggestionsVisible);
  const setIsVisible = useStoreWithAi((s) => s.ai.setPromptSuggestionsVisible);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const toggleVisibility = useCallback(() => {
    setIsVisible(!isVisible);
  }, [isVisible, setIsVisible]);

  const updateScrollState = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const {scrollLeft, scrollWidth, clientWidth} = container;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 1);
  }, []);

  const scrollBy = useCallback((direction: 'left' | 'right') => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollAmount = 200; // Scroll by roughly one item width
    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    updateScrollState();

    container.addEventListener('scroll', updateScrollState);
    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(container);

    return () => {
      container.removeEventListener('scroll', updateScrollState);
      resizeObserver.disconnect();
    };
  }, [updateScrollState, children]);

  if (!isVisible) {
    return null;
  }

  return (
    <TooltipProvider>
      <div className={cn('relative w-full py-1', className)}>
        {/* Container with scrollable suggestions and hide button */}
        <div className="flex h-full w-full gap-2">
          {/* Left scroll arrow */}
          <button
            onClick={() => scrollBy('left')}
            disabled={!canScrollLeft}
            className={cn(
              'absolute top-0 left-0 z-10 flex h-full w-8 items-center justify-start pl-1',
              'from-background/80 bg-gradient-to-r to-transparent',
              'opacity-0 transition-opacity hover:opacity-100',
              !canScrollLeft && 'pointer-events-none',
            )}
            title="Scroll left"
          >
            <ChevronLeft className="text-muted-foreground h-5 w-5" />
          </button>

          {/* Scrollable suggestions container */}
          <div
            ref={scrollContainerRef}
            className="flex flex-1 snap-x snap-mandatory scroll-pl-1 gap-2 overflow-x-auto overflow-y-hidden px-1 py-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {isLoading
              ? // Show placeholder buttons with spinners while loading
                Array.from({length: 3}).map((_, index) => (
                  <div key={index} className="shrink-0 snap-start">
                    <Button
                      disabled
                      className={cn(
                        'bg-muted/50 border-border border',
                        'rounded-lg',
                        'text-muted-foreground text-xs',
                        'relative',
                        'flex items-center justify-center',
                        'px-4 py-2',
                        'h-18 max-h-18 min-h-18 w-48 max-w-48 min-w-48',
                      )}
                      type="button"
                    >
                      <Spinner className="text-muted-foreground h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))
              : children}
          </div>

          {/* Right scroll arrow */}
          <button
            onClick={() => scrollBy('right')}
            disabled={!canScrollRight}
            className={cn(
              'absolute top-0 right-8 z-10 flex h-full w-8 items-center justify-end pr-1',
              'from-background/80 bg-gradient-to-l to-transparent',
              'opacity-0 transition-opacity hover:opacity-100',
              !canScrollRight && 'pointer-events-none',
            )}
            title="Scroll right"
          >
            <ChevronRight className="text-muted-foreground h-5 w-5" />
          </button>

          <div className="flex shrink-0 items-center pr-1">
            <Button
              onClick={toggleVisibility}
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground h-6 w-6 shrink-0"
              title="Hide prompt suggestions"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};

type PromptSuggestionsItemProps = {
  text: string;
  className?: string;
  icon?: React.ReactNode;
};

/**
 * Individual prompt suggestion item component
 * Displays a single prompt suggestion and handles click events
 */
const Item: React.FC<PromptSuggestionsItemProps> = ({
  text,
  className,
  icon,
}) => {
  const currentSession = useStoreWithAi((s) => s.ai.getCurrentSession());
  const setPrompt = useStoreWithAi((s) => s.ai.setPrompt);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleClick = useCallback(() => {
    if (currentSession?.id) {
      setPrompt(currentSession.id, text);
    }
    // Scroll the clicked item into view
    buttonRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest',
    });
  }, [text, setPrompt, currentSession]);

  return (
    <div className="shrink-0 snap-start">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            ref={buttonRef}
            onClick={handleClick}
            className={cn(
              'bg-muted/50 hover:bg-muted hover:shadow-lg',
              'border-border hover:border-primary/50 border',
              'rounded-lg',
              'text-muted-foreground hover:text-foreground text-xs',
              'transition-all duration-200 ease-in-out',
              'hover:-translate-y-0.5 hover:scale-[1.02]',
              'cursor-pointer',
              'relative',
              'flex items-start justify-start',
              'text-left',
              'overflow-hidden',
              'py-2 pr-4 pl-8',
              'h-18 max-h-18 min-h-18 w-48 max-w-48 min-w-48',
              className,
            )}
            type="button"
            title={text}
          >
            <span className="absolute top-3 left-2 opacity-60">
              {icon ?? <Lightbulb className="h-3.5 w-3.5" />}
            </span>
            <span className="line-clamp-2 text-wrap break-words">
              {truncate(text, 40)}
            </span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs">{text}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
};

type PromptSuggestionsVisibilityToggleProps = {
  className?: string;
  icon?: React.ReactNode;
};

/**
 * Toggle button for showing/hiding prompt suggestions
 * Can be placed anywhere in the UI
 * Always shows a Lightbulb icon with styling that changes based on state
 */
const VisibilityToggle: React.FC<PromptSuggestionsVisibilityToggleProps> = ({
  className,
  icon,
}) => {
  const isVisible = useStoreWithAi((s) => s.ai.promptSuggestionsVisible);
  const setIsVisible = useStoreWithAi((s) => s.ai.setPromptSuggestionsVisible);

  const toggleVisibility = useCallback(() => {
    setIsVisible(!isVisible);
  }, [isVisible, setIsVisible]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          onClick={toggleVisibility}
          variant="ghost"
          size="icon"
          className={cn(
            'h-6 w-6 shrink-0',
            isVisible
              ? 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              : 'text-muted-foreground hover:text-foreground',
            className,
          )}
          title={
            isVisible ? 'Hide prompt suggestions' : 'Show prompt suggestions'
          }
        >
          {icon ?? <Lightbulb className="h-4 w-4" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>
          {isVisible ? 'Hide prompt suggestions' : 'Show prompt suggestions'}
        </p>
      </TooltipContent>
    </Tooltip>
  );
};

/**
 * Composable PromptSuggestions component with Container, Item, and VisibilityToggle subcomponents
 *
 * @example
 * ```tsx
 * <PromptSuggestions.Container isLoading={false}>
 *   <PromptSuggestions.Item text="What are the top selling products?" />
 *   <PromptSuggestions.Item text="Show me the revenue trends" />
 * </PromptSuggestions.Container>
 *
 * <PromptSuggestions.VisibilityToggle />
 * ```
 */
export const PromptSuggestions = {
  Container,
  Item,
  VisibilityToggle,
};
