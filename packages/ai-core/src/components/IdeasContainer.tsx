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
import {useCallback, useState} from 'react';
import {useStoreWithAi} from '../AiSlice';

type IdeasContainerProps = {
  ideas?: string[];
  isLoading?: boolean;
  className?: string;
};

export const IdeasContainer: React.FC<IdeasContainerProps> = ({
  ideas = [],
  isLoading = false,
  className,
}) => {
  const setAnalysisPrompt = useStoreWithAi((s) => s.ai.setAnalysisPrompt);
  const [isVisible, setIsVisible] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  const truncateText = useCallback((text: string, maxLength: number = 40) => {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength) + '...';
  }, []);

  const handleIdeaClick = useCallback(
    (idea: string) => {
      setAnalysisPrompt(idea);
    },
    [setAnalysisPrompt],
  );

  const toggleVisibility = useCallback(() => {
    setIsVisible((prev) => !prev);
  }, []);

  if ((!ideas || ideas.length === 0) && !isLoading) {
    return null;
  }

  return (
    <TooltipProvider>
      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          'relative flex w-full gap-2 overflow-x-auto overflow-y-hidden p-1 mt-2',
          isVisible ? 'h-20' : 'h-8',
          (isHovered || !isVisible) && 'pl-8',
          '[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]',
          className,
        )}
      >
        {(isHovered || !isVisible) && (
          <Button
            onClick={toggleVisibility}
            variant="ghost"
            size="icon"
            className={cn(
              'absolute left-1 z-10 h-6 w-6 text-muted-foreground hover:text-foreground shrink-0',
              isVisible ? 'bottom-1' : 'top-1/2 -translate-y-1/2',
            )}
            title={isVisible ? 'Hide ideas' : 'Show ideas'}
          >
            {isVisible ? <X className="h-4 w-4" /> : <Lightbulb className="h-4 w-4" />}
          </Button>
        )}
        {isVisible && (
          <>
            {isLoading ? (
              // Show placeholder buttons with spinners while loading
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
                    'py-2 px-4',
                    'h-18 max-h-18 min-h-18 w-48 min-w-48 max-w-48',
                  )}
                  type="button"
                >
                  <Spinner className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              ))
            ) : (
              ideas.map((idea, index) => (
                <Tooltip key={index}>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={() => handleIdeaClick(idea)}
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
                      )}
                      type="button"
                      title={idea}
                    >
                      <Lightbulb className="absolute left-2 top-3 h-3.5 w-3.5 opacity-60" />
                      <span className="line-clamp-2 text-wrap break-words">
                        {truncateText(idea)}
                      </span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">{idea}</p>
                  </TooltipContent>
                </Tooltip>
              ))
            )}
          </>
        )}
      </div>
    </TooltipProvider>
  );
};
