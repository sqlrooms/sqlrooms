import * as React from 'react';

/**
 * Uses layout effect in the browser and falls back to effect during SSR.
 */
const useIsomorphicLayoutEffect =
  typeof window === 'undefined' ? React.useEffect : React.useLayoutEffect;

/**
 * Options for {@link useAutoResizeTextarea}.
 */
export interface UseAutoResizeTextareaOptions {
  /** Whether auto-resize is active. When false, the hook is a no-op. */
  autoResize: boolean;
  /**
   * Ref to the textarea element to measure and resize. This can point to any
   * textarea element reached via a ref — including one rendered by a
   * component the caller does not own, such as a host's own text-input
   * component — not only one this hook's caller rendered itself.
   */
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  /** The textarea's current controlled value, if any. */
  value: React.ComponentProps<'textarea'>['value'];
  /** The textarea's uncontrolled default value, if any. */
  defaultValue: React.ComponentProps<'textarea'>['defaultValue'];
}

/**
 * Return value of {@link useAutoResizeTextarea}.
 */
export interface UseAutoResizeTextareaResult {
  /** True when the content's height exceeds the element's `max-height`. */
  hasOverflow: boolean;
  /** Re-measures the element and applies its resized height immediately. */
  resizeToFitContent: () => void;
}

/**
 * Keeps a textarea's height synchronized with its content and container
 * width.
 *
 * This hook carries no assumptions about who rendered the textarea: it reads
 * and writes only through the DOM node reached via `textareaRef`, so it can
 * be applied to a textarea rendered by any component, not only one from this
 * package. This is what allows auto-grow behavior to be layered onto a
 * caller-supplied text input that does not implement it itself.
 *
 * The resize path is intentionally triggered from multiple sources (input,
 * value changes, and width changes) and then deduped per frame.
 *
 * @param options - See {@link UseAutoResizeTextareaOptions}.
 * @returns See {@link UseAutoResizeTextareaResult}.
 */
export function useAutoResizeTextarea({
  autoResize,
  textareaRef,
  value,
  defaultValue,
}: UseAutoResizeTextareaOptions): UseAutoResizeTextareaResult {
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
