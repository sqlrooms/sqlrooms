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
  const measure = useCallback(() => {
    const el = innerRef.current;
    if (!el) return;
    const h = el.scrollHeight;
    setOverflows(h > maxCollapsedHeight);
  }, [maxCollapsedHeight]);

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(() => measure());
    const mo = new MutationObserver(() => measure());
    ro.observe(el);
    mo.observe(el, {childList: true, subtree: true, characterData: true});
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, [measure]);

  // Auto-scroll to bottom when running and content changes
  useEffect(() => {
    if (!isRunning) return;
    const container = scrollRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  });

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
          className="overflow-y-hidden"
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

        {showOverlay && (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 rounded-b-md"
            style={{
              height: '32px',
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
