import * as React from 'react';
import {cn} from '../lib/utils';

type TextareaProps = React.ComponentProps<'textarea'> & {
  autoResize?: boolean;
};

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {className, autoResize = false, onInput, value, defaultValue, ...props},
    ref,
  ) => {
    const localRef = React.useRef<HTMLTextAreaElement>(null);

    React.useImperativeHandle(
      ref,
      () => localRef.current as HTMLTextAreaElement,
    );

    const resizeToFitContent = React.useCallback(() => {
      const el = localRef.current;
      if (!el || !autoResize) return;
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }, [autoResize]);

    React.useEffect(() => {
      // Trigger on mount and whenever the controlled value changes
      resizeToFitContent();
    }, [resizeToFitContent, value, defaultValue]);

    const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
      if (autoResize) resizeToFitContent();
      if (onInput) onInput(e);
    };

    return (
      <textarea
        className={cn(
          'border-input placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[60px] w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-sm focus-visible:outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          className,
        )}
        ref={localRef}
        onInput={handleInput}
        value={value}
        defaultValue={defaultValue}
        {...props}
      />
    );
  },
);
Textarea.displayName = 'Textarea';

export {Textarea};
