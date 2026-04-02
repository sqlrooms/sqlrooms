import {ChevronDownIcon, ChevronRightIcon} from 'lucide-react';
import {useMemo, useState} from 'react';
import {cn} from '@sqlrooms/ui';
import {useStoreWithAi} from '../AiSlice';
import {useElapsedTime} from '../hooks/useElapsedTime';
import {truncateToFit} from '../hooks/useToolGrouping';

type ReasoningBoxProps = {
  children: React.ReactNode;
  className?: string;
  title?: React.ReactNode;
  defaultOpen?: boolean;
  /** Whether tool calls in this group are still executing */
  isRunning?: boolean;
  /** Tool call IDs used to derive the group's elapsed time from store timings */
  toolCallIds?: string[];
  /** When set, shows the latest sub-agent tool reasoning as a live subtitle */
  agentToolCallId?: string;
  /** Container width in pixels, used to truncate sub-reasoning text */
  containerWidth?: number;
};
export const ReasoningBox: React.FC<ReasoningBoxProps> = ({
  children,
  className,
  title,
  defaultOpen = false,
  isRunning = false,
  toolCallIds,
  agentToolCallId,
  containerWidth = 0,
}) => {
  const displayTitle = title ?? 'Processing';
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const toolTimings = useStoreWithAi((s) => s.ai.toolTimings);

  const agentProgress = useStoreWithAi((s) =>
    agentToolCallId ? s.ai.agentProgress[agentToolCallId] : undefined,
  );

  const {startedAt, completedAt} = useMemo(() => {
    if (!toolCallIds?.length)
      return {startedAt: undefined, completedAt: undefined};
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
    return {
      startedAt: earliest,
      completedAt: allCompleted ? latest : undefined,
    };
  }, [toolCallIds, toolTimings]);

  const elapsedText = useElapsedTime(isRunning, startedAt, completedAt);

  const latestSubReasoning = useMemo(() => {
    if (!agentProgress || agentProgress.length === 0) return undefined;
    for (let i = agentProgress.length - 1; i >= 0; i--) {
      const tc = agentProgress[i];
      if (
        tc?.input instanceof Object &&
        'reasoning' in tc.input &&
        typeof (tc.input as Record<string, unknown>).reasoning === 'string'
      ) {
        const reasoning = (tc.input as Record<string, unknown>)
          .reasoning as string;
        const agentName = tc.toolName
          .replace(/-/g, ' ')
          .replace(/([a-z])([A-Z])/g, '$1 $2')
          .replace(/\b\w/g, (c) => c.toUpperCase());
        const prefix = `${agentName}: `;
        const truncated = truncateToFit(
          reasoning,
          containerWidth,
          prefix.length,
        );
        return truncated ? `${prefix}${truncated}` : undefined;
      }
    }
    return undefined;
  }, [agentProgress, containerWidth]);

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
        <span className="flex-1 truncate">
          {isRunning && latestSubReasoning ? latestSubReasoning : displayTitle}
        </span>
        {elapsedText && (
          <span className="shrink-0 text-gray-400 dark:text-gray-500">
            {elapsedText}
          </span>
        )}
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
