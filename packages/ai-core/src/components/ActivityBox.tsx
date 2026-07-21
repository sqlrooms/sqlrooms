import {cn} from '@sqlrooms/ui';
import {ChevronDown, ChevronRight, ChevronsUp} from 'lucide-react';
import React, {useCallback, useEffect, useRef, useState} from 'react';

const DEFAULT_MAX_HEIGHT = 100;

type ActivityBoxProps = {
  children: React.ReactNode;
  /** Max collapsed height in px. Defaults to 100. */
  maxCollapsedHeight?: number;
  /** When true, the box auto-scrolls to the bottom as content changes. */
  isRunning?: boolean;
  className?: string;
  /**
   * When provided, the box can be fully hidden behind a single clickable
   * summary line (e.g. "Worked with 4 tools"). Clicking the line toggles
   * visibility of the full activity box. While `isRunning` is true the
   * box is always shown regardless of this prop.
   */
  summaryLabel?: string;
  /**
   * When true, render the streamlined "Simple Mode" box: collapsed to a single
   * line (`latestActivity`) that the user can click anywhere to expand into the
   * full activity log. No expand/collapse chevron buttons are shown.
   */
  simpleMode?: boolean;
  /**
   * The single line shown while collapsed in Simple Mode — typically the latest
   * tool call's reasoning. Ignored when `simpleMode` is false.
   */
  latestActivity?: React.ReactNode;
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
  summaryLabel,
  simpleMode = false,
  latestActivity,
}) => {
  if (simpleMode) {
    return (
      <SimpleActivityBox
        isRunning={isRunning}
        className={className}
        latestActivity={latestActivity}
        summaryLabel={summaryLabel}
      >
        {children}
      </SimpleActivityBox>
    );
  }

  return (
    <ClassicActivityBox
      maxCollapsedHeight={maxCollapsedHeight}
      isRunning={isRunning}
      className={className}
      summaryLabel={summaryLabel}
    >
      {children}
    </ClassicActivityBox>
  );
};

/**
 * Streamlined Simple Mode box. Collapsed, it shows a single clickable line —
 * the run summary (`summaryLabel`, e.g. "Worked with 3 tools") once the run is
 * complete, otherwise the latest activity (`latestActivity`). Clicking anywhere
 * expands the full activity log. No expand/collapse chevron buttons are
 * rendered, keeping the box compact.
 */
const SimpleActivityBox: React.FC<{
  children: React.ReactNode;
  isRunning: boolean;
  className?: string;
  latestActivity?: React.ReactNode;
  summaryLabel?: string;
}> = ({children, isRunning, className, latestActivity, summaryLabel}) => {
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the bottom while running and expanded so the latest activity
  // stays visible.
  useEffect(() => {
    if (!isRunning || !expanded) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  });

  const collapsedContent = summaryLabel ? (
    <span>{summaryLabel}</span>
  ) : (
    (latestActivity ?? children)
  );

  return (
    <div
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      onClick={() => setExpanded((v) => !v)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setExpanded((v) => !v);
        }
      }}
      className={cn(
        'border-border/50 hover:border-border min-w-0 cursor-pointer overflow-hidden rounded-md border transition-colors',
        className,
      )}
    >
      {expanded ? (
        <div
          ref={scrollRef}
          className="text-muted-foreground max-h-64 w-full min-w-0 overflow-y-auto p-2.5 text-xs break-words hyphens-auto"
        >
          {children}
        </div>
      ) : (
        <div className="text-muted-foreground w-full min-w-0 overflow-hidden p-2 text-xs break-words hyphens-auto">
          {collapsedContent}
        </div>
      )}
    </div>
  );
};

/**
 * A fixed-height container that auto-scrolls to the latest content while
 * running. The user cannot scroll the content manually. When content overflows
 * the collapsed height, a gradient fade and expand button appear. Clicking
 * expands to full height; a collapse button returns to the capped view.
 */
const ClassicActivityBox: React.FC<{
  children: React.ReactNode;
  maxCollapsedHeight: number;
  isRunning: boolean;
  className?: string;
  summaryLabel?: string;
}> = ({
  children,
  maxCollapsedHeight = DEFAULT_MAX_HEIGHT,
  isRunning = false,
  className,
  summaryLabel,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  // Tracks which summaryLabel the user explicitly expanded. When the label
  // changes (e.g. tool count updates) the override resets, auto-collapsing again.
  const [expandedForLabel, setExpandedForLabel] = useState<string | null>(null);

  const visible = !summaryLabel || expandedForLabel === summaryLabel;

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
  }, [measure, updateScrollFlags, visible, isRunning]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = () => updateScrollFlags();
    el.addEventListener('scroll', handler, {passive: true});
    return () => el.removeEventListener('scroll', handler);
  }, [updateScrollFlags, visible, isRunning]);

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
  const showBox = isRunning || !summaryLabel || visible;

  if (!showBox) {
    return (
      <button
        onClick={() => setExpandedForLabel(summaryLabel ?? null)}
        className={cn(
          'text-muted-foreground hover:text-foreground flex w-full cursor-pointer items-center gap-1 py-0.5 text-xs transition-colors',
          className,
        )}
      >
        <ChevronRight className="h-3 w-3 shrink-0" />
        <span>{summaryLabel}</span>
      </button>
    );
  }

  return (
    <div
      className={cn(
        'border-border/50 min-w-0 overflow-hidden rounded-md border p-1',
        className,
      )}
    >
      {summaryLabel && !isRunning && (
        <button
          onClick={() => setExpandedForLabel(null)}
          className="text-muted-foreground hover:text-foreground flex w-full cursor-pointer items-center gap-1 px-1.5 pt-1 pb-0.5 text-xs transition-colors"
        >
          <ChevronDown className="h-3 w-3 shrink-0" />
          <span>{summaryLabel}</span>
        </button>
      )}
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
            className="text-muted-foreground w-full min-w-0 overflow-hidden p-2.5 text-xs break-words hyphens-auto"
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
