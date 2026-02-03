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

  const updateScrollState = () => {
    const container = containerRef.current;
    if (!container) return;

    const {scrollLeft, scrollWidth, clientWidth} = container;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 1);
  };

  const scrollBy = (direction: 'left' | 'right') => {
    const container = containerRef.current;
    if (!container) return;

    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  useEffect(() => {
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
    'absolute top-0 z-10 flex h-full w-8 items-center backdrop-blur-md bg-background/50',
    arrowVisibility === 'hover'
      ? 'opacity-0 transition-opacity hover:opacity-100'
      : 'opacity-100',
    arrowClassName,
  );

  return (
    <div className={cn('relative', className)}>
      <button
        onClick={() => scrollBy('left')}
        disabled={!canScrollLeft}
        className={cn(
          arrowBaseClass,
          'left-0 justify-start pl-1',
          'from-background/90 via-background/60 bg-gradient-to-r to-transparent',
          !canScrollLeft && 'pointer-events-none opacity-0',
        )}
        title="Scroll left"
      >
        <ChevronLeft
          className={cn('text-muted-foreground h-5 w-5', arrowIconClassName)}
        />
      </button>

      <div ref={containerRef} className={scrollClassName}>
        {children}
      </div>

      <button
        onClick={() => scrollBy('right')}
        disabled={!canScrollRight}
        className={cn(
          arrowBaseClass,
          'right-0 justify-end pr-1',
          'from-background/90 via-background/60 bg-gradient-to-l to-transparent',
          !canScrollRight && 'pointer-events-none opacity-0',
        )}
        title="Scroll right"
      >
        <ChevronRight
          className={cn('text-muted-foreground h-5 w-5', arrowIconClassName)}
        />
      </button>
    </div>
  );
}
