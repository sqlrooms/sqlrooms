import {cn, Tooltip, TooltipContent, TooltipTrigger} from '@sqlrooms/ui';
import {ElementRef, forwardRef} from 'react';

type Props = {
  tooltipContent?: React.ReactNode;
  icon: React.ReactNode;
  side?: 'right' | 'left' | 'top' | 'bottom';
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
  onClick?: () => void;
  disabled?: boolean;
} & React.HTMLAttributes<HTMLDivElement>;

export const IconWithTooltip = forwardRef<ElementRef<'div'>, Props>(
  (props, ref) => {
    const {
      className,
      title,
      tooltipContent,
      icon,
      align = 'center',
      side = 'bottom',
      sideOffset = 10,
      onClick,
      disabled = false,
      ...restOfProps
    } = props;
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            ref={ref}
            {...restOfProps}
            className={cn(
              'text-foreground flex w-full cursor-pointer items-center justify-center rounded',
              disabled && 'pointer-events-none cursor-not-allowed opacity-50',
              className,
            )}
            onClick={onClick}
          >
            {icon}
          </div>
        </TooltipTrigger>
        {title && (
          <TooltipContent
            className="text-xs"
            side={side}
            align={align}
            sideOffset={sideOffset}
          >
            {tooltipContent ? tooltipContent : title}
          </TooltipContent>
        )}
      </Tooltip>
    );
  },
);
IconWithTooltip.displayName = 'IconWithTooltip';
