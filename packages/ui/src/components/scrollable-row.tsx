import {ChevronLeft, ChevronRight} from 'lucide-react';
import React, {useEffect, useRef, useState} from 'react';
import {cn} from '../lib/utils';

type ScrollableRowProps = {
  children: React.ReactNode;
  className?: string;
  scrollClassName?: string;
  scrollRef?: React.RefObject<HTMLDivElement>;
  scrollAmount?: number;
  arrowVisibility?: 'hover' | 'always';
  arrowClassName?: string;
  arrowIconClassName?: string;
};

export function ScrollableRow({
  children,
  className,
  scrollClassName,
  scrollRef,
  scrollAmount = 200,
  arrowVisibility = 'hover',
  arrowClassName,
  arrowIconClassName,
}: ScrollableRowProps) {
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

    // The container's own box stays fixed when its content changes size (e.g.
    // loading placeholders replaced by wider suggestions), so ResizeObserver
    // on the container alone would leave the arrows stale. Observe each child
    // element instead, and re-observe as children are added or removed, so
    // overflow changes track content-size changes too.
    const contentObserver = new ResizeObserver(updateScrollState);
    const observeChildren = () => {
      contentObserver.disconnect();
      for (const child of Array.from(container.children)) {
        contentObserver.observe(child);
      }
    };
    observeChildren();

    const mutationObserver = new MutationObserver(() => {
      observeChildren();
      updateScrollState();
    });
    mutationObserver.observe(container, {childList: true});

    return () => {
      container.removeEventListener('scroll', updateScrollState);
      resizeObserver.disconnect();
      contentObserver.disconnect();
      mutationObserver.disconnect();
    };
    // `children` is intentionally excluded from the deps: it is typically a
    // fresh array on every parent render, and re-running this effect (which
    // calls setState) on every render would trip React's "Maximum update depth
    // exceeded" warning. Content changes are handled instead by observing the
    // child elements above; the scroll listener covers user/dnd scrolling.
  }, [containerRef]);

  const arrowBaseClass = cn(
    'absolute top-0 z-10 flex h-full w-8 items-center backdrop-blur-md bg-background/50 transition-colors',
    arrowVisibility === 'hover'
      ? 'opacity-0 transition-opacity hover:opacity-100'
      : 'opacity-100',
    arrowClassName,
  );

  return (
    <div className={cn('relative', className)}>
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
}
