import {
  CircleArrowRightIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  Loader2,
} from 'lucide-react';
import {useState} from 'react';
import {cn} from '@sqlrooms/ui';

/**
 * Props for the ToolCallInfoBox component
 */
type ToolCallInfoProps = {
  toolName: string;
  input: unknown;
  isCompleted: boolean;
  state:
    | 'input-streaming'
    | 'input-available'
    | 'output-available'
    | 'output-error';
};

/**
 * Component that renders a tool call is running
 * Shows the tool name and truncated arguments by default.
 * Click on the tool name to expand and see full arguments.
 *
 * @component
 * @param props - Component props
 * @param props.toolName - Name of the tool being called
 * @param props.input - Input arguments passed to the tool
 * @param props.isCompleted - Whether the tool call has completed
 * @param props.state - Current state of the tool call
 * @returns A React component displaying the tool call details
 */
export const ToolCallInfo: React.FC<ToolCallInfoProps> = ({
  toolName,
  input,
  isCompleted,
  state,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 pl-2 text-xs text-gray-700 dark:text-gray-300">
        {/* Loading/Completed Indicator */}
        {state !== 'output-available' && state !== 'output-error' ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-gray-400 dark:text-gray-500" />
        ) : (
          <CircleArrowRightIcon className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" />
        )}

        {/* Clickable Tool Name */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
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
        </button>
      </div>

      {/* Expanded Arguments */}
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
