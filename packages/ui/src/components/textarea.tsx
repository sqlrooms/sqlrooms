import * as React from 'react';
import {cn} from '../lib/utils';

type TextareaProps = React.ComponentProps<'textarea'> & {
  autoResize?: boolean;
};

const useIsomorphicLayoutEffect =
  typeof window === 'undefined' ? React.useEffect : React.useLayoutEffect;

function useAutoResizeTextarea({
  autoResize,
  textareaRef,
  value,
  defaultValue,
}: {
  autoResize: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: React.ComponentProps<'textarea'>['value'];
  defaultValue: React.ComponentProps<'textarea'>['defaultValue'];
}) {
  const [hasOverflow, setHasOverflow] = React.useState(false);
  const lastMeasuredWidthRef = React.useRef<number>(0);
  const resizeFrameRef = React.useRef<number | null>(null);

  const applyResizeToFitContent = React.useCallback(() => {
    const el = textareaRef.current;
    if (!el || !autoResize || typeof window === 'undefined') return;

    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;

    const computedStyle = window.getComputedStyle(el);
    const maxHeight = computedStyle.maxHeight;
    if (maxHeight && maxHeight !== 'none') {
      const maxHeightValue = parseFloat(maxHeight);
      setHasOverflow(el.scrollHeight > maxHeightValue);
    } else {
      setHasOverflow(false);
    }
  }, [autoResize, textareaRef]);

  const resizeToFitContent = React.useCallback(() => {
    if (!autoResize || typeof window === 'undefined') return;

    // Keep input/effect-triggered resize paths for robustness, but collapse
    // same-frame calls into one DOM measurement/write cycle.
    if (resizeFrameRef.current !== null) return;

    resizeFrameRef.current = window.requestAnimationFrame(() => {
      resizeFrameRef.current = null;
      applyResizeToFitContent();
    });
  }, [autoResize, applyResizeToFitContent]);

  useIsomorphicLayoutEffect(() => {
    resizeToFitContent();
  }, [resizeToFitContent, value, defaultValue]);

  React.useEffect(() => {
    if (!autoResize) return;

    const el = textareaRef.current;
    if (!el || typeof window === 'undefined') return;

    // Re-measure after layout settles so hidden/collapsed mount states
    // don't leave a stale oversized height.
    resizeToFitContent();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    lastMeasuredWidthRef.current = el.getBoundingClientRect().width;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;

      const nextWidth = entry.contentRect.width;
      if (Math.abs(nextWidth - lastMeasuredWidthRef.current) < 1) {
        return;
      }

      lastMeasuredWidthRef.current = nextWidth;
      resizeToFitContent();
    });

    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, [autoResize, resizeToFitContent, textareaRef]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    return () => {
      if (resizeFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = null;
      }
    };
  }, []);

  return {
    hasOverflow,
    resizeToFitContent,
  };
}

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
