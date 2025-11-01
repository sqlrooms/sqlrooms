import {
  cn,
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@sqlrooms/ui';
import {Lightbulb} from 'lucide-react';
import {useCallback} from 'react';
import {useStoreWithAi} from '../AiSlice';

type IdeasContainerProps = {
  ideas?: string[];
  className?: string;
};

export const IdeasContainer: React.FC<IdeasContainerProps> = ({
  ideas = [],
  className,
}) => {
  const setAnalysisPrompt = useStoreWithAi((s) => s.ai.setAnalysisPrompt);

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

  if (!ideas || ideas.length === 0) {
    return null;
  }

  return (
    <TooltipProvider>
      <div
        className={cn(
          'scrollbar-hide no-scrollbar flex h-20 w-full gap-2 overflow-x-auto p-1',
          className,
        )}
      >
        {ideas.map((idea, index) => (
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
        ))}
      </div>
    </TooltipProvider>
  );
};
