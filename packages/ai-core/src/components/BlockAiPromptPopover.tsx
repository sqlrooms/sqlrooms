import {
  Button,
  cn,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Textarea,
} from '@sqlrooms/ui';
import {ArrowUpIcon, LoaderCircleIcon} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

export type BlockAiPromptPopoverProps = {
  trigger: ReactNode;
  onSubmit: (prompt: string) => void;
  placeholder?: string;
  label?: string;
  isRunning?: boolean;
  disabled?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function BlockAiPromptPopover({
  trigger,
  onSubmit,
  placeholder,
  label,
  isRunning = false,
  disabled = false,
  open,
  onOpenChange,
}: BlockAiPromptPopoverProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [internalOpen, setInternalOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const actualOpen = open ?? internalOpen;
  const ariaLabel = label ?? placeholder;
  const canSubmit = !disabled && !isRunning && prompt.trim().length > 0;

  const setOpen = useCallback(
    (nextOpen: boolean) => {
      if (disabled && nextOpen) return;
      if (!nextOpen) {
        setPrompt('');
      }
      setInternalOpen(nextOpen);
      onOpenChange?.(nextOpen);
    },
    [disabled, onOpenChange],
  );

  useEffect(() => {
    if (!actualOpen || disabled || isRunning) return;
    const timer = window.setTimeout(() => textareaRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [actualOpen, disabled, isRunning]);

  const handleSubmit = useCallback(() => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt || disabled || isRunning) return;
    onSubmit(trimmedPrompt);
    setPrompt('');
    setOpen(false);
  }, [disabled, isRunning, onSubmit, prompt, setOpen]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (
        event.key === 'Enter' &&
        !event.shiftKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.metaKey
      ) {
        event.preventDefault();
        handleSubmit();
      } else if (event.key === 'Escape') {
        setOpen(false);
      }
    },
    [handleSubmit, setOpen],
  );

  return (
    <Popover open={actualOpen} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span
          className={cn(
            'inline-flex',
            disabled && 'pointer-events-none opacity-50',
          )}
          aria-disabled={disabled || undefined}
        >
          {trigger}
        </span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0" sideOffset={6}>
        <div className="bg-muted/50 flex w-full flex-col gap-1 rounded-md border">
          {label ? (
            <div className="flex items-center gap-2 px-3 pt-3">
              <div className="min-w-0 flex-1 text-sm font-medium">{label}</div>
              {isRunning ? (
                <LoaderCircleIcon className="text-muted-foreground h-4 w-4 animate-spin" />
              ) : null}
            </div>
          ) : isRunning ? (
            <div className="flex justify-end px-3 pt-3">
              <LoaderCircleIcon className="text-muted-foreground h-4 w-4 animate-spin" />
            </div>
          ) : null}
          <Textarea
            ref={textareaRef}
            className="max-h-[min(220px,35vh)] min-h-[72px] resize-none border-none bg-transparent p-3 text-sm outline-hidden focus-visible:ring-0"
            autoResize
            value={prompt}
            disabled={disabled || isRunning}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            aria-label={ariaLabel}
          />
          <div className="flex w-full items-center justify-end gap-1 p-2 pt-0">
            <Button
              className="h-8 w-8 rounded-full"
              variant="default"
              size="icon"
              onClick={handleSubmit}
              disabled={!canSubmit}
              aria-label={ariaLabel}
            >
              {isRunning ? (
                <LoaderCircleIcon className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUpIcon className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
