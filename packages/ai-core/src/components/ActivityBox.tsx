import {cn} from '@sqlrooms/ui';
import {ChevronDown, ChevronRight, ChevronsUp, SparklesIcon} from 'lucide-react';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {useElapsedTime} from '../hooks/useElapsedTime';

const DEFAULT_MAX_HEIGHT = 100;

/** Props for the collapsible SQLRooms activity container. */
export type ActivityBoxProps = {
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
   * Start of the activity, for the live elapsed time in the header. Ticks
   * every second while {@link ActivityBoxProps.isRunning} is true.
   */
  startedAt?: number;
  /** Step count shown next to the elapsed time, e.g. "step 4". */
  stepCount?: number;
};

/**
 * The activity box's header: what the agent is doing, how long it has been
 * doing it, and a disclosure control for the log below.
 */
const ActivityHeader: React.FC<{
  label: string;
  isRunning: boolean;
  startedAt?: number;
  stepCount?: number;
  isOpen: boolean;
  /** False while running, when the box is pinned open. */
  canToggle: boolean;
  onToggle: () => void;
}> = ({
  label,
  isRunning,
  startedAt,
  stepCount,
  isOpen,
  canToggle,
  onToggle,
}) => {
  const elapsed = useElapsedTime(isRunning, startedAt);
  // Running: the live clock plus which step is underway. Settled: how many
  // steps it took — the duration is already part of `label`.
  const meta = isRunning
    ? [elapsed, stepCount ? `step ${stepCount}` : undefined]
        .filter(Boolean)
        .join(' · ')
    : stepCount
      ? `${stepCount} step${stepCount === 1 ? '' : 's'}`
      : '';

  return (
    <button
      type="button"
      onClick={canToggle ? onToggle : undefined}
      disabled={!canToggle}
      className={cn(
        'flex w-full items-center gap-1.5 px-3 py-1.5 text-xs transition-colors',
        canToggle && 'hover:bg-muted/40 cursor-pointer',
      )}
    >
      {/* The brand tint marks work in progress; a settled group reads as
          ordinary chrome. */}
      <SparklesIcon
        className={cn(
          'size-3.5 shrink-0',
          isRunning ? 'text-primary' : 'text-muted-foreground',
        )}
      />
      <span
        className={cn(
          'font-medium',
          isRunning ? 'text-primary' : 'text-muted-foreground',
        )}
      >
        {label}
      </span>
      {meta && <span className="text-muted-foreground">· {meta}</span>}
      {canToggle &&
        (isOpen ? (
          <ChevronDown className="text-muted-foreground ml-auto size-3.5 shrink-0" />
        ) : (
          <ChevronRight className="text-muted-foreground ml-auto size-3.5 shrink-0" />
        ))}
    </button>
  );
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
  startedAt,
  stepCount,
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

  const header = summaryLabel ? (
    <ActivityHeader
      label={summaryLabel}
      isRunning={isRunning}
      startedAt={startedAt}
      stepCount={stepCount}
      isOpen={showBox}
      canToggle={!isRunning}
      onToggle={() =>
        setExpandedForLabel(showBox ? null : (summaryLabel ?? null))
      }
    />
  ) : null;

  if (!showBox) {
    return (
      <div
        className={cn(
          'border-border/50 min-w-0 overflow-hidden rounded-lg border',
          className,
        )}
      >
        {header}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'border-border/50 min-w-0 overflow-hidden rounded-lg border',
        className,
      )}
    >
      {header}
      <div className={cn('relative', header && 'border-border/50 border-t')}>
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
