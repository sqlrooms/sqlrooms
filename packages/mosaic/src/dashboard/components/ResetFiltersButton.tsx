import {
  Button,
  cn,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@sqlrooms/ui';
import {FilterX} from 'lucide-react';
import {type ComponentProps, type FC, type ReactNode} from 'react';

export type ResetFiltersButtonProps = Omit<
  ComponentProps<typeof Button>,
  'onClick' | 'disabled'
> & {
  disabled: boolean;
  iconClassName?: string;
  onClick: () => void;
  tooltip?: ReactNode;
};

/**
 * Reusable reset filters button UI component.
 * Renders a ghost button with FilterX icon.
 */
export const ResetFiltersButton: FC<ResetFiltersButtonProps> = ({
  className,
  disabled,
  iconClassName,
  onClick,
  tooltip = 'Reset filters',
  ...props
}) => {
  const button = (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      className={cn('h-6 w-6', className)}
      aria-label="Reset filters"
      disabled={disabled}
      onClick={onClick}
      {...props}
    >
      <FilterX className={cn('h-3.5 w-3.5', iconClassName)} />
    </Button>
  );

  if (!tooltip) {
    return button;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
};
