'use client';

import {CheckIcon, CopyIcon} from 'lucide-react';
import * as React from 'react';
import {cn} from '../lib/utils';
import {Button, type ButtonProps} from './button';
import {Tooltip, TooltipContent, TooltipTrigger} from './tooltip';

export interface CopyButtonProps {
  text: string | (() => string);
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  className?: string;
  tooltipLabel?: string;
  ariaLabel?: string;
  durationMs?: number;
  disabled?: boolean;
  onCopied?: () => void;
}

export const CopyButton: React.FC<CopyButtonProps> = ({
  text,
  variant = 'ghost',
  size = 'icon',
  className,
  tooltipLabel = 'Copy to clipboard',
  ariaLabel: ariaLabelProp,
  durationMs = 1500,
  disabled = false,
  onCopied,
}) => {
  const ariaLabel = ariaLabelProp ?? tooltipLabel;
  const [copied, setCopied] = React.useState(false);
  const timeoutRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleClick = async () => {
    try {
      const textToCopy = typeof text === 'function' ? text() : text;
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      if (typeof onCopied === 'function') onCopied();
      timeoutRef.current = window.setTimeout(
        () => setCopied(false),
        durationMs,
      );
    } catch (e) {
      // no-op
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={cn(
            'text-muted-foreground hover:text-foreground transition-text h-8 w-8 duration-200',
            className,
          )}
          aria-label={ariaLabel}
          type="button"
          disabled={disabled}
          onClick={handleClick}
        >
          <span
            className={cn(
              'inline-flex items-center justify-center transition-all duration-150',
              copied ? 'scale-110 opacity-100' : 'opacity-90',
            )}
          >
            {copied ? (
              <CheckIcon className="h-4 w-4 text-green-500" />
            ) : (
              <CopyIcon className="h-4 w-4" />
            )}
          </span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{tooltipLabel}</TooltipContent>
    </Tooltip>
  );
};
