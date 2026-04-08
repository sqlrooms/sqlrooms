import {ChevronDownIcon, ChevronRightIcon} from 'lucide-react';
import {useMemo, useState} from 'react';
import {cn} from '@sqlrooms/ui';
import {formatShortDuration} from '@sqlrooms/utils';
import {useStoreWithAi} from '../AiSlice';
import {useElapsedTime} from '../hooks/useElapsedTime';

type ReasoningBoxProps = {
  children: React.ReactNode;
  className?: string;
  title?: React.ReactNode;
  defaultOpen?: boolean;
  isRunning?: boolean;
  /** Tool call IDs in this group, used for computing elapsed time */
  toolCallIds?: string[];
};
export const ReasoningBox: React.FC<ReasoningBoxProps> = ({
  children,
  className,
  title,
  defaultOpen = false,
  isRunning = false,
  toolCallIds,
}) => {
  const toolTimings = useStoreWithAi((s) => s.ai.toolTimings);

  const groupTiming = useMemo(() => {
    if (!toolCallIds?.length) return undefined;
    let earliest: number | undefined;
    let latest: number | undefined;
    let allCompleted = true;
    for (const id of toolCallIds) {
      const t = toolTimings[id];
      if (!t) continue;
      if (earliest == null || t.startedAt < earliest) earliest = t.startedAt;
      if (t.completedAt != null) {
        if (latest == null || t.completedAt > latest) latest = t.completedAt;
      } else {
        allCompleted = false;
      }
    }
    return earliest != null
      ? {startedAt: earliest, completedAt: allCompleted ? latest : undefined}
      : undefined;
  }, [toolCallIds, toolTimings]);

  const elapsedText = useElapsedTime(
    isRunning,
    groupTiming?.startedAt,
    groupTiming?.completedAt,
  );

  const displayTitle = useMemo(() => {
    if (title) {
      if (!elapsedText) return title;
      return (
        <span className="flex w-full items-center justify-between">
          <span className="min-w-0 truncate">{title}</span>
          <span className="ml-2 shrink-0 text-gray-400">{elapsedText}</span>
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
          'flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-normal',
          'text-gray-500 dark:text-gray-400',
          'hover:bg-muted/80 transition-colors',
          isOpen ? 'rounded-t-md' : 'rounded-md',
        )}
      >
        {isOpen ? (
          <ChevronDownIcon className="h-3 w-3 shrink-0" />
        ) : (
          <ChevronRightIcon className="h-3 w-3 shrink-0" />
        )}
        <span className="flex-1 truncate">{displayTitle}</span>
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
