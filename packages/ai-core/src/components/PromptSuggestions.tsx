import {
  cn,
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  Spinner,
} from '@sqlrooms/ui';
import {Lightbulb, X} from 'lucide-react';
import {PropsWithChildren, useCallback} from 'react';
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

  const toggleVisibility = useCallback(() => {
    setIsVisible(!isVisible);
  }, [isVisible, setIsVisible]);

  if (!isVisible) {
    return null;
  }

  return (
    <TooltipProvider>
      <div
        className={cn('relative w-full', isVisible ? 'h-20' : 'h-0', className)}
      >
        {/* Container with scrollable suggestions and hide button */}
        <div className="flex h-full w-full gap-2">
          {/* Scrollable suggestions container */}
          <div className="flex flex-1 gap-2 overflow-x-auto overflow-y-hidden px-1 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {isLoading
              ? // Show placeholder buttons with spinners while loading
                Array.from({length: 3}).map((_, index) => (
                  <Button
                    key={index}
                    disabled
                    className={cn(
                      'bg-muted/50 border-border border',
                      'rounded-lg',
                      'text-muted-foreground text-xs',
                      'shrink-0',
                      'relative',
                      'flex items-center justify-center',
                      'px-4 py-2',
                      'h-18 max-h-18 min-h-18 w-48 min-w-48 max-w-48',
                    )}
                    type="button"
                  >
                    <Spinner className="text-muted-foreground h-3.5 w-3.5" />
                  </Button>
                ))
              : children}
          </div>

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
};

/**
 * Individual prompt suggestion item component
 * Displays a single prompt suggestion and handles click events
 */
const Item: React.FC<PromptSuggestionsItemProps> = ({text, className}) => {
  const setAnalysisPrompt = useStoreWithAi((s) => s.ai.setAnalysisPrompt);

  const handleClick = useCallback(() => {
    setAnalysisPrompt(text);
  }, [text, setAnalysisPrompt]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          onClick={handleClick}
          className={cn(
            'bg-muted/50 hover:bg-muted hover:shadow-lg',
            'border-border hover:border-primary/50 border',
            'rounded-lg',
            'text-muted-foreground hover:text-foreground text-xs',
            'transition-all duration-200 ease-in-out',
            'hover:-translate-y-0.5 hover:scale-[1.02]',
            'shrink-0',
            'cursor-pointer',
            'relative',
            'flex items-start justify-start',
            'text-left',
            'overflow-hidden',
            'py-2 pl-8 pr-4',
            'h-18 max-h-18 min-h-18 w-48 min-w-48 max-w-48',
            className,
          )}
          type="button"
          title={text}
        >
          <Lightbulb className="absolute left-2 top-3 h-3.5 w-3.5 opacity-60" />
          <span className="line-clamp-2 text-wrap break-words">
            {truncate(text, 40)}
          </span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p className="max-w-xs">{text}</p>
      </TooltipContent>
    </Tooltip>
  );
};

type PromptSuggestionsVisibilityToggleProps = {
  className?: string;
};

/**
 * Toggle button for showing/hiding prompt suggestions
 * Can be placed anywhere in the UI
 * Always shows a Lightbulb icon with styling that changes based on state
 */
const VisibilityToggle: React.FC<PromptSuggestionsVisibilityToggleProps> = ({
  className,
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
          <Lightbulb className="h-4 w-4" />
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
