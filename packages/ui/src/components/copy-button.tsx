'use client';

import * as React from 'react';
import {Button, type ButtonProps} from './button';
import {ClipboardIcon, CheckIcon} from 'lucide-react';
import {cn} from '../lib/utils';

export interface CopyButtonProps {
  text: string | (() => string);
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  className?: string;
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
  ariaLabel = 'Copy to clipboard',
  durationMs = 1500,
  disabled = false,
  onCopied,
}) => {
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
    <Button
      variant={variant}
      size={size}
      className={className}
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
          <ClipboardIcon className="h-4 w-4" />
        )}
      </span>
    </Button>
  );
};
