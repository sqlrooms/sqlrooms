import {useDebouncedCallback} from '@sqlrooms/ui';
import {
  forwardRef,
  PropsWithChildren,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';

export type PlotSize = {
  width: number;
  height: number;
};

export type ResponsivePlotProps = PropsWithChildren<{
  onResize: (size: PlotSize) => void;
  debounceMs?: number;
  className?: string;
}>;

/**
 * Container component that measures its size and notifies parent via callback.
 * Uses ResizeObserver with debouncing to reduce update frequency.
 * Exposes ref to the container div for direct DOM access.
 */
export const ResponsivePlot = forwardRef<HTMLDivElement, ResponsivePlotProps>(
  (
    {onResize, debounceMs = 150, className = 'h-full w-full', children},
    ref,
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const lastSizeRef = useRef<PlotSize | null>(null);

    // Expose the internal ref to parent
    useImperativeHandle(ref, () => containerRef.current!, []);

    // Debounced callback to reduce re-render frequency during resizing
    const onResizeDebounced = useDebouncedCallback((size: PlotSize) => {
      // Only call onResize if size actually changed
      if (
        !lastSizeRef.current ||
        lastSizeRef.current.width !== size.width ||
        lastSizeRef.current.height !== size.height
      ) {
        lastSizeRef.current = size;
        onResize(size);
      }
    }, debounceMs);

    // Measure container size with ResizeObserver
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const {width, height} = entry.contentRect;
          if (width > 0 && height > 0) {
            onResizeDebounced({width, height});
          }
        }
      });

      resizeObserver.observe(container);
      return () => resizeObserver.disconnect();
    }, [onResizeDebounced]);

    return (
      <div ref={containerRef} className={className}>
        {children}
      </div>
    );
  },
);

ResponsivePlot.displayName = 'ResponsivePlot';
