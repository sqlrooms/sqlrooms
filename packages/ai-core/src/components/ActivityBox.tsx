import {cn} from '@sqlrooms/ui';
import {ChevronDown, ChevronsUp} from 'lucide-react';
import React, {useCallback, useEffect, useRef, useState} from 'react';

const DEFAULT_MAX_HEIGHT = 100;

type ActivityBoxProps = {
  children: React.ReactNode;
  /** Max collapsed height in px. Defaults to 100. */
  maxCollapsedHeight?: number;
  /** When true, the box auto-scrolls to the bottom as content changes. */
  isRunning?: boolean;
  className?: string;
};

/**
 * A fixed-height container that auto-scrolls to the latest content while
 * running. The user cannot scroll the content manually. When content overflows
 * the collapsed height, a gradient fade and expand button appear. Clicking
 * expands to full height; a collapse button returns to the capped view.
 */
export const ActivityBox: React.FC<ActivityBoxProps> = ({
  children,
  maxCollapsedHeight = DEFAULT_MAX_HEIGHT,
  isRunning = false,
  className,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const measure = useCallback(() => {
    const el = innerRef.current;
    if (!el) return;
    const h = el.scrollHeight;
    setOverflows(h > maxCollapsedHeight);
  }, [maxCollapsedHeight]);

  const updateScrollFlags = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const threshold = 2;
    setCanScrollUp(el.scrollTop > threshold);
    setCanScrollDown(
      el.scrollTop + el.clientHeight < el.scrollHeight - threshold,
    );
  }, []);

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(() => {
      measure();
      updateScrollFlags();
    });
    const mo = new MutationObserver(() => {
      measure();
      updateScrollFlags();
    });
    ro.observe(el);
    mo.observe(el, {childList: true, subtree: true, characterData: true});
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, [measure, updateScrollFlags]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = () => updateScrollFlags();
    el.addEventListener('scroll', handler, {passive: true});
    return () => el.removeEventListener('scroll', handler);
  }, [updateScrollFlags]);

  // Auto-scroll to bottom when running and content changes
  useEffect(() => {
    if (!isRunning) return;
    const container = scrollRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  });

  // Re-evaluate scroll flags after expand/collapse or overflow changes
  useEffect(() => {
    updateScrollFlags();
  }, [expanded, overflows, updateScrollFlags]);

  const showOverlay = overflows && !expanded;

  return (
    <div
      className={cn(
        'border-border/50 min-w-0 overflow-hidden rounded-md border p-1',
        className,
      )}
    >
      <div className="relative">
        <div
          ref={scrollRef}
          className="overflow-y-auto"
          style={{
            ...(expanded ? {} : {maxHeight: `${maxCollapsedHeight}px`}),
          }}
        >
          <div
            ref={innerRef}
            className="text-muted-foreground w-full min-w-0 overflow-hidden p-2.5 text-xs break-words"
          >
            {children}
          </div>
        </div>

        {showOverlay && canScrollUp && (
          <div
            className="pointer-events-none absolute inset-x-0 top-0 rounded-t-md"
            style={{
              height: '32px',
              background:
                'linear-gradient(to top, transparent 0%, hsl(var(--background)) 100%)',
            }}
          />
        )}
        {showOverlay && canScrollDown && (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 rounded-b-md"
            style={{
              height: '22px',
              background:
                'linear-gradient(to bottom, transparent 0%, hsl(var(--background)) 100%)',
            }}
          />
        )}
      </div>

      {showOverlay && (
        <div className="flex items-center justify-center py-0.5">
          <button
            onClick={() => setExpanded(true)}
            className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-0.5 text-[10px] transition-colors"
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>
      )}

      {expanded && overflows && (
        <div className="flex justify-center py-0.5">
          <button
            onClick={() => setExpanded(false)}
            className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-0.5 text-[10px] transition-colors"
          >
            <ChevronsUp className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
};
