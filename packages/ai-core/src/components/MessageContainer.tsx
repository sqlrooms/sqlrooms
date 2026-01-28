import {JsonMonacoEditor} from '@sqlrooms/monaco-editor';
import {
  Badge,
  Button,
  cn,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@sqlrooms/ui';
import {CodeIcon, XCircleIcon} from 'lucide-react';

type MessageContainerProps = {
  className?: string;
  isSuccess: boolean;
  // borderColor: string;
  type: string;
  content: object;
  children: React.ReactNode;
};

export const MessageContainer: React.FC<MessageContainerProps> = ({
  className,
  type,
  // borderColor,
  content,
  children,
}) => {
  return (
    <div
      className={cn(
        'group relative px-5 py-2 text-xs',
        className,
        type === 'error' && 'border-destructive rounded-md border py-4',
        // borderColor,
        // isSuccess ? borderColor : 'border-red-500',
      )}
    >
      {type === 'error' && (
        <Badge
          variant="secondary"
          className={cn(
            'absolute left-2 top-[-12px] flex items-center gap-1 border text-xs',
            'border-destructive bg-background',
            // isSuccess ? borderColor : 'border-red-500',
          )}
        >
          {/* {isSuccess ? ( */}
          {/* <CheckCircle2Icon className="h-3 w-3 text-green-500" /> */}
          {/* ) : ( */}
          <XCircleIcon className="h-3 w-3 text-red-500" />
          {/* )} */}
          {type ? type.replace(/^\w/, (c) => c.toUpperCase()) : ''}
        </Badge>
      )}

      <div className="flex flex-col gap-5">{children}</div>
    </div>
  );
};
