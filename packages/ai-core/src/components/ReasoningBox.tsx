import {ChevronDownIcon, ChevronRightIcon, Loader2} from 'lucide-react';
import {useMemo, useState} from 'react';
import {cn} from '@sqlrooms/ui';
import {formatShortDuration} from '@sqlrooms/utils';
import {useStoreWithAi} from '../AiSlice';
import {useElapsedTime} from '../hooks/useElapsedTime';
import type {ReasoningTitleDescriptor} from '../utils';

/**
 * Renders a ReasoningTitleDescriptor as a React node.
 * Use alongside generateReasoningTitle() for consistent reasoning-box titles.
 */
export const ReasoningTitle: React.FC<{
  descriptor: ReasoningTitleDescriptor;
}> = ({descriptor}) => {
  switch (descriptor.kind) {
    case 'agent':
    case 'skill':
      return (
        <span className="flex items-center gap-1.5">
          <span className="text-muted-foreground/70 font-medium">
            {descriptor.kind === 'agent' ? 'Agent' : 'Skill'}
          </span>
          <span className="text-muted-foreground/40">·</span>
          <span>{descriptor.humanName}</span>
        </span>
      );
    case 'running':
    case 'completed':
      return <>{descriptor.text}</>;
  }
};

type ReasoningBoxProps = {
  children: React.ReactNode;
  className?: string;
  title?: React.ReactNode;
  defaultOpen?: boolean;
  isRunning?: boolean;
  /** Tool call IDs in this group, used for computing elapsed time */
  toolCallIds?: string[];
  /** Direct start timestamp (epoch ms), used when toolCallIds are not available */
  startedAt?: number;
  /** Direct completion timestamp (epoch ms), used when toolCallIds are not available */
  completedAt?: number;
};
export const ReasoningBox: React.FC<ReasoningBoxProps> = ({
  children,
  className,
  title,
  defaultOpen = false,
  isRunning = false,
  toolCallIds,
  startedAt: directStartedAt,
  completedAt: directCompletedAt,
}) => {
  const toolTimings = useStoreWithAi((s) => s.ai.toolTimings);

  // Self-managed timing: used only as a live fallback when no persisted timing
  // data exists yet and the group is actively running. Once isRunning becomes
  // false the frozen elapsed value from useElapsedTime is kept.
  const [selfStartedAt] = useState(() => Date.now());

  const groupTiming = useMemo(() => {
    if (directStartedAt != null) {
      return {startedAt: directStartedAt, completedAt: directCompletedAt};
    }
    if (toolCallIds?.length) {
      let earliest: number | undefined;
      let latest: number | undefined;
      let latestTimestamp: number | undefined;
      let allCompleted = true;
      for (const id of toolCallIds) {
        const t = toolTimings[id];
        if (!t) continue;
        if (earliest == null || t.startedAt < earliest) earliest = t.startedAt;
        if (latestTimestamp == null || t.startedAt > latestTimestamp)
          latestTimestamp = t.startedAt;
        if (t.completedAt != null) {
          if (latest == null || t.completedAt > latest) latest = t.completedAt;
          if (latestTimestamp == null || t.completedAt > latestTimestamp)
            latestTimestamp = t.completedAt;
        } else {
          allCompleted = false;
        }
      }
      if (earliest != null) {
        // When the group is no longer running but some tools are missing
        // completedAt (e.g. interrupted session reloaded from disk), use the
        // latest known timestamp so we show a static duration instead of an
        // ever-growing elapsed time.
        const completedAt = allCompleted
          ? latest
          : !isRunning
            ? latestTimestamp
            : undefined;
        return {startedAt: earliest, completedAt};
      }
      // toolCallIds were given but none had timing data in the store.
      // For old projects (no persisted timings) that are already complete,
      // return undefined so no misleading duration is shown.
      if (!isRunning) {
        return undefined;
      }
    }
    // Fallback: live session with no store data yet — use mount time
    return {startedAt: selfStartedAt, completedAt: undefined};
  }, [
    toolCallIds,
    toolTimings,
    directStartedAt,
    directCompletedAt,
    selfStartedAt,
    isRunning,
  ]);

  const elapsedText = useElapsedTime(
    isRunning,
    groupTiming?.startedAt,
    groupTiming?.completedAt,
  );

  const displayTitle = useMemo(() => {
    if (title) {
      if (!elapsedText) return title;
      return (
        <span className="flex w-full items-center justify-between gap-2">
          <span className="min-w-0">{title}</span>
          <span className="shrink-0 text-gray-400">{elapsedText}</span>
        </span>
      );
    }
    const label = isRunning ? 'Processing' : 'Worked';
    if (groupTiming?.completedAt && groupTiming?.startedAt) {
      return `${label} for ${formatShortDuration(groupTiming.completedAt - groupTiming.startedAt)}`;
    }
    if (elapsedText) return `${label} for ${elapsedText}`;
    return label;
  }, [title, isRunning, elapsedText, groupTiming]);

  const [isOpen, setIsOpen] = useState(defaultOpen);

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className={cn('border-muted rounded-md border', className)}>
      <button
        onClick={handleToggle}
        className={cn(
          'flex w-full items-start gap-2 px-3 py-2 text-left text-xs font-normal',
          'text-gray-500 dark:text-gray-400',
          'hover:bg-muted/80 transition-colors',
          isOpen ? 'rounded-t-md' : 'rounded-md',
        )}
      >
        <span className="mt-0.5 flex shrink-0 items-center gap-2">
          {isRunning && <Loader2 className="h-3 w-3 shrink-0 animate-spin" />}
          {isOpen ? (
            <ChevronDownIcon className="h-3 w-3 shrink-0" />
          ) : (
            <ChevronRightIcon className="h-3 w-3 shrink-0" />
          )}
        </span>
        <span className="min-w-0 flex-1">{displayTitle}</span>
      </button>
      {isOpen && (
        <div
          className={cn(
            'overflow-y-auto px-3 pb-3',
            'scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent',
            'dark:scrollbar-thumb-gray-600',
            'selection:bg-primary/30 selection:text-foreground',
          )}
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgb(209 213 219) transparent',
          }}
        >
          <div className="flex flex-col gap-2 pt-2">{children}</div>
        </div>
      )}
    </div>
  );
};
