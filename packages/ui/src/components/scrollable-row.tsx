import {ChevronLeft, ChevronRight} from 'lucide-react';
import React, {useEffect, useRef, useState} from 'react';
import {cn} from '../lib/utils';

/**
 * Props for {@link ScrollableRow}. Any other `div` prop is spread onto the
 * outer wrapper, so the component composes through a slot.
 */
type ScrollableRowProps = {
  children: React.ReactNode;
  /** Classes for the outer wrapper, which positions the arrows. */
  className?: string;
  /** Classes for the inner horizontally scrolling container. */
  scrollClassName?: string;
  /**
   * Ref to the inner scrolling container, for reading or driving its scroll
   * position. Distinct from the component's forwarded ref, which points at the
   * outer wrapper — see {@link ScrollableRow}.
   */
  scrollRef?: React.RefObject<HTMLDivElement>;
  /** Pixels scrolled per arrow activation. Defaults to 200. */
  scrollAmount?: number;
  /** Whether the arrows appear on hover only, or stay visible. */
  arrowVisibility?: 'hover' | 'always';
  arrowClassName?: string;
  arrowIconClassName?: string;
} & Omit<React.ComponentPropsWithoutRef<'div'>, 'children' | 'className'>;

/**
 * A horizontally scrolling row with overflow-aware previous/next arrows, which
 * appear only in the direction there is more content.
 *
 * **Two refs, two elements.** The forwarded ref is the **outer wrapper** (which
 * also takes `className` and extra `div` props), so wrapping this in a Radix
 * `Slot` or a drop target works. `scrollRef` is the **inner scrolling
 * container**, for reading or setting `scrollLeft`; supplying it replaces the
 * internal ref, and the arrows keep working either way.
 */
export const ScrollableRow = React.forwardRef<
  HTMLDivElement,
  ScrollableRowProps
>(function ScrollableRow(
  {
    children,
    className,
    scrollClassName,
    scrollRef,
    scrollAmount = 200,
    arrowVisibility = 'hover',
    arrowClassName,
    arrowIconClassName,
    ...rest
  },
  forwardedRef,
) {
  const internalRef = useRef<HTMLDivElement>(null);
  const containerRef = scrollRef ?? internalRef;
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const scrollBy = (direction: 'left' | 'right') => {
    const container = containerRef.current;
    if (!container) return;

    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  useEffect(() => {
    const updateScrollState = () => {
      const container = containerRef.current;
      if (!container) return;

      const {scrollLeft, scrollWidth, clientWidth} = container;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 1);
    };

    const container = containerRef.current;
    if (!container) return;

    updateScrollState();

    container.addEventListener('scroll', updateScrollState);
    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(container);

    return () => {
      container.removeEventListener('scroll', updateScrollState);
      resizeObserver.disconnect();
    };
  }, [children, containerRef]);

  const arrowBaseClass = cn(
    'absolute top-0 z-10 flex h-full w-8 items-center backdrop-blur-md bg-background/50 transition-colors',
    arrowVisibility === 'hover'
      ? 'opacity-0 transition-opacity hover:opacity-100'
      : 'opacity-100',
    arrowClassName,
  );

  return (
    <div ref={forwardedRef} className={cn('relative', className)} {...rest}>
      <button
        type="button"
        onClick={() => scrollBy('left')}
        disabled={!canScrollLeft}
        className={cn(
          arrowBaseClass,
          'left-0 justify-start pl-1',
          'from-background/90 via-background/60 group bg-gradient-to-r to-transparent',
          !canScrollLeft && 'pointer-events-none opacity-0',
        )}
        aria-label="Scroll left"
        title="Scroll left"
      >
        <ChevronLeft
          className={cn(
            'text-muted-foreground group-hover:text-foreground h-5 w-5 transition-colors',
            arrowIconClassName,
          )}
        />
      </button>

      <div ref={containerRef} className={scrollClassName}>
        {children}
      </div>

      <button
        type="button"
        onClick={() => scrollBy('right')}
        disabled={!canScrollRight}
        className={cn(
          arrowBaseClass,
          'right-0 justify-end pr-1',
          'from-background/90 via-background/60 group bg-gradient-to-l to-transparent',
          !canScrollRight && 'pointer-events-none opacity-0',
        )}
        aria-label="Scroll right"
        title="Scroll right"
      >
        <ChevronRight
          className={cn(
            'text-muted-foreground group-hover:text-foreground h-5 w-5 transition-colors',
            arrowIconClassName,
          )}
        />
      </button>
    </div>
  );
});

ScrollableRow.displayName = 'ScrollableRow';
