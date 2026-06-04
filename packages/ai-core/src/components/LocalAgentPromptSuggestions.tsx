import {
  Button,
  cn,
  ScrollableRow,
  Spinner,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@sqlrooms/ui';
import {truncate} from '@sqlrooms/utils';
import {Lightbulb, X} from 'lucide-react';
import {
  useCallback,
  useRef,
  type FC,
  type PropsWithChildren,
  type ReactNode,
} from 'react';
import {useChatRuntime} from './ChatRuntimeContext';

export type LocalAgentPromptSuggestionsContainerProps = PropsWithChildren<{
  isLoading?: boolean;
  className?: string;
}>;

export const LocalAgentPromptSuggestionsContainer: FC<
  LocalAgentPromptSuggestionsContainerProps
> = ({isLoading = false, className, children}) => {
  const runtime = useChatRuntime();
  if (runtime.mode !== 'local-agent') return null;
  if (!runtime.suggestionsVisible) return null;

  const content =
    children ??
    runtime.initialSuggestions.map((text) => (
      <LocalAgentPromptSuggestionItem key={text} text={text} />
    ));

  if (!isLoading && runtime.initialSuggestions.length === 0 && !children) {
    return null;
  }

  return (
    <div className={cn('w-full py-1', className)}>
      <div className="flex h-full w-full gap-2">
        <ScrollableRow
          className="min-w-0 flex-1"
          scrollClassName="flex flex-1 snap-x snap-mandatory scroll-pl-7 scroll-pr-7 gap-2 overflow-x-auto overflow-y-hidden px-1 py-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          arrowVisibility="always"
          arrowIconClassName="h-4 w-4 opacity-80"
        >
          {isLoading
            ? Array.from({length: 3}).map((_, index) => (
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
                      'h-18 max-h-14 min-h-14 w-48 max-w-48 min-w-48',
                    )}
                    type="button"
                  >
                    <Spinner className="text-muted-foreground h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            : content}
        </ScrollableRow>

        <div className="flex shrink-0 items-center pr-1">
          <Button
            onClick={() => runtime.setSuggestionsVisible(false)}
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
  );
};

export type LocalAgentPromptSuggestionItemProps = {
  text: string;
  className?: string;
  icon?: ReactNode;
};

export const LocalAgentPromptSuggestionItem: FC<
  LocalAgentPromptSuggestionItemProps
> = ({text, className, icon}) => {
  const runtime = useChatRuntime();
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleClick = useCallback(() => {
    if (runtime.mode === 'local-agent') {
      runtime.setPrompt(text);
    }
    buttonRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest',
    });
  }, [runtime, text]);

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
              'h-18 max-h-14 min-h-14 w-48 max-w-48 min-w-48',
              className,
            )}
            type="button"
            title={text}
          >
            <span className="absolute top-3 left-2 opacity-60">
              {icon ?? <Lightbulb className="h-3.5 w-3.5" />}
            </span>
            <span className="line-clamp-2 text-wrap wrap-break-word">
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

export type LocalAgentPromptSuggestionsVisibilityToggleProps = {
  className?: string;
  icon?: ReactNode;
};

export const LocalAgentPromptSuggestionsVisibilityToggle: FC<
  LocalAgentPromptSuggestionsVisibilityToggleProps
> = ({className, icon}) => {
  const runtime = useChatRuntime();

  const toggleVisibility = useCallback(() => {
    if (runtime.mode !== 'local-agent') return;
    runtime.setSuggestionsVisible(!runtime.suggestionsVisible);
  }, [runtime]);

  if (runtime.mode !== 'local-agent') return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          onClick={toggleVisibility}
          variant="ghost"
          size="icon"
          className={cn(
            'h-6 w-6 shrink-0',
            runtime.suggestionsVisible
              ? 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              : 'text-muted-foreground hover:text-foreground',
            className,
          )}
          aria-label={
            runtime.suggestionsVisible
              ? 'Hide prompt suggestions'
              : 'Show prompt suggestions'
          }
        >
          {icon ?? <Lightbulb className="h-4 w-4" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>
          {runtime.suggestionsVisible
            ? 'Hide prompt suggestions'
            : 'Show prompt suggestions'}
        </p>
      </TooltipContent>
    </Tooltip>
  );
};
