import {ChevronDownIcon, ChevronRightIcon} from 'lucide-react';
import {useState, useMemo} from 'react';
import {cn} from '@sqlrooms/ui';
import {useElapsedTime} from '../hooks/useElapsedTime';
import {useStoreWithAi} from '../AiSlice';

type ReasoningBoxProps = {
  children: React.ReactNode;
  className?: string;
  title?: React.ReactNode;
  defaultOpen?: boolean;
  /** Whether the tool group is still executing (drives the elapsed timer) */
  isRunning?: boolean;
  /** Tool call IDs whose timings should be used to derive the group elapsed */
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
  const displayTitle = title ?? 'Thought';
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const toolTimings = useStoreWithAi((s) => s.ai.toolTimings);

  const {groupStartedAt, groupCompletedAt} = useMemo(() => {
    if (!toolCallIds?.length) return {};
    let earliest: number | undefined;
    let latestEnd: number | undefined;
    let allComplete = true;

    for (const tcId of toolCallIds) {
      const entry = toolTimings[tcId];
      if (!entry) {
        allComplete = false;
        continue;
      }
      if (earliest == null || entry.startedAt < earliest) {
        earliest = entry.startedAt;
      }
      if (entry.completedAt != null) {
        if (latestEnd == null || entry.completedAt > latestEnd) {
          latestEnd = entry.completedAt;
        }
      } else {
        allComplete = false;
      }
    }

    return {
      groupStartedAt: earliest,
      groupCompletedAt: allComplete ? latestEnd : undefined,
    };
  }, [toolCallIds, toolTimings]);

  const elapsedText = useElapsedTime(
    isRunning,
    groupStartedAt,
    groupCompletedAt,
  );

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
