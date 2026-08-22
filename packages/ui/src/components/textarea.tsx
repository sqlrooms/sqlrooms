import * as React from 'react';
import {cn} from '../lib/utils';
import {useAutoResizeTextarea} from '../hooks/useAutoResizeTextarea';

type TextareaProps = React.ComponentProps<'textarea'> & {
  autoResize?: boolean;
};

/**
 * Textarea component with optional auto-resize behavior.
 */
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      autoResize = false,
      onInput,
      value,
      defaultValue,
      rows,
      ...props
    },
    ref,
  ) => {
    const localRef = React.useRef<HTMLTextAreaElement>(null);

    React.useImperativeHandle(
      ref,
      () => localRef.current as HTMLTextAreaElement,
    );

    const {hasOverflow, resizeToFitContent} = useAutoResizeTextarea({
      autoResize,
      textareaRef: localRef,
      value,
      defaultValue,
    });

    const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
      if (autoResize) resizeToFitContent();
      if (onInput) onInput(e);
    };

    return (
      <textarea
        className={cn(
          'border-input placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[60px] w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-sm focus-visible:ring-1 focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          autoResize
            ? hasOverflow
              ? 'overflow-y-auto'
              : 'overflow-y-hidden'
            : undefined,
          className,
        )}
        rows={rows ?? (autoResize ? 1 : undefined)}
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
