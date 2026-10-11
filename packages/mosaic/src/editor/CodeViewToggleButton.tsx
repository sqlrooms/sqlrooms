import {
  Button,
  cn,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@sqlrooms/ui';
import {CodeIcon} from 'lucide-react';
import type {FC} from 'react';

export type CodeViewToggleButtonProps = {
  /** Accessible label and tooltip text for the button. */
  label?: string;
  /** Whether the code view is currently selected. */
  selected?: boolean;
  /** Called when the code view toggle is clicked. */
  onClick?: () => void;
  /** Additional classes for the button. */
  className?: string;
};

/** Small header action button for toggling between settings and code views. */
export const CodeViewToggleButton: FC<CodeViewToggleButtonProps> = ({
  label = 'View code',
  selected,
  onClick,
  className,
}) => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant={selected ? 'secondary' : 'ghost'}
            size="icon"
            className={cn('h-6 w-6', className)}
            onClick={onClick}
            aria-label={label}
            aria-pressed={selected}
          >
            <CodeIcon className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
