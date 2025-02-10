import {ToolResultSchema} from './schemas';
import {
  Badge,
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  cn,
} from '@sqlrooms/ui';
import {CheckCircle2Icon, CodeIcon, XCircleIcon} from 'lucide-react';

interface ToolResultProps {
  toolResult: ToolResultSchema;
}

export const ToolResult: React.FC<ToolResultProps> = ({toolResult}) => {
  const {toolName, args, result} = toolResult;
  const isSuccess = result.success;

  return (
    <div
      className={cn(
        'border-2 relative bg-gray-900 px-5 py-6 rounded-md text-gray-300 text-xs',
        isSuccess ? 'border-green-500' : 'border-red-500',
      )}
    >
      <Badge
        variant="secondary"
        className={cn(
          'text-xs absolute top-[-12px] left-2 text-gray-100 flex items-center gap-1 border',
          isSuccess ? 'border-green-500' : 'border-red-500',
        )}
      >
        {isSuccess ? (
          <CheckCircle2Icon className="w-3 h-3 text-green-500" />
        ) : (
          <XCircleIcon className="w-3 h-3 text-red-500" />
        )}
        {toolName}
      </Badge>

      <div className="absolute top-2 right-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon" className="w-6 h-6">
              <CodeIcon className="w-4 h-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[400px] max-h-[300px] overflow-auto p-4"
            side="right"
            align="start"
          >
            <pre className="whitespace-no-wrap text-xs">
              {JSON.stringify(toolResult, null, 2)}
            </pre>
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex flex-col gap-5">
        {args.reasoning && (
          <div className="text-xs text-gray-400">{args.reasoning}</div>
        )}
        {args.sqlQuery && <div className="font-mono">{args.sqlQuery}</div>}
        {!result.success && (
          <div className="text-red-500 gap-2 flex flex-col">
            <p className="text-sm font-bold">Oops! Something went wrong...</p>
            <p className="text-xs">{result.error}</p>
          </div>
        )}
      </div>
    </div>
  );
};
