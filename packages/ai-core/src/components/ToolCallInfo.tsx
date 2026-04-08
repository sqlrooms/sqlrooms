import {
  CircleArrowRightIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  Loader2,
} from 'lucide-react';
import {useState, useCallback} from 'react';
import {cn} from '@sqlrooms/ui';
import {useElapsedTime} from '../hooks/useElapsedTime';
import {useStoreWithAi} from '../AiSlice';

type ToolCallInfoProps = {
  toolName: string;
  input: unknown;
  state:
    | 'input-streaming'
    | 'input-available'
    | 'output-available'
    | 'output-error'
    | 'approval-requested'
    | 'approval-responded'
    | 'output-denied';
  /** Stable key for elapsed-time lookup (e.g. toolCallId) */
  stableKey?: string;
  /** When true, suppress the elapsed-time display (e.g. for agent tools whose
   *  sub-steps already show their own timers). */
  hideElapsed?: boolean;
};

/**
 * Component that renders a tool call info row.
 * Shows the tool name, live elapsed time, and expandable arguments.
 */
export const ToolCallInfo: React.FC<ToolCallInfoProps> = ({
  toolName,
  input,
  state,
  stableKey,
  hideElapsed = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const toggle = useCallback(() => setIsExpanded((v) => !v), []);

  const isRunning =
    state !== 'output-available' &&
    state !== 'output-error' &&
    state !== 'output-denied';

  const timing = useStoreWithAi((s) =>
    stableKey ? s.ai.toolTimings[stableKey] : undefined,
  );
  const elapsedText = useElapsedTime(
    isRunning,
    timing?.startedAt,
    timing?.completedAt,
  );
  const showElapsed = !hideElapsed && elapsedText;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 pl-2 text-xs text-gray-700 dark:text-gray-300">
        {isRunning ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-gray-400 dark:text-gray-500" />
        ) : state === 'output-denied' ? (
          <CircleArrowRightIcon className="h-4 w-4 shrink-0 text-red-400 dark:text-red-500" />
        ) : (
          <CircleArrowRightIcon className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" />
        )}

        <button
          onClick={toggle}
          className={cn(
            'flex items-center gap-1 rounded px-1 py-0.5 font-medium transition-colors',
            'text-gray-700',
          )}
        >
          {isExpanded ? (
            <ChevronDownIcon className="h-3 w-3" />
          ) : (
            <ChevronRightIcon className="h-3 w-3" />
          )}
          <span>{toolName}</span>
          {showElapsed && (
            <span className="ml-1 font-normal text-gray-400 dark:text-gray-500">
              {elapsedText}
            </span>
          )}
        </button>
      </div>

      {isExpanded && (
        <div className="px-5 py-2">
          <pre className="text-muted-foreground bg-muted m-0 max-h-24 overflow-auto rounded-md p-2 font-mono text-xs wrap-break-word whitespace-pre-wrap">
            {JSON.stringify(input, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};
