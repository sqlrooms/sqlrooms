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
            'border-destructive text-destructive bg-background',
            // isSuccess ? borderColor : 'border-red-500',
          )}
        >
          {/* {isSuccess ? ( */}
          {/* <CheckCircle2Icon className="h-3 w-3 text-green-500" /> */}
          {/* ) : ( */}
          <XCircleIcon className="h-3 w-3 text-red-500" />
          {/* )} */}
          {type}
        </Badge>
      )}

      <div className="absolute right-2 top-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <CodeIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="max-h-[300px] w-[400px] overflow-auto p-4"
            side="right"
            align="start"
          >
            <JsonMonacoEditor
              value={JSON.stringify(content, null, 2)}
              readOnly={true}
              className="h-[250px]"
              options={{
                minimap: {enabled: false},
                scrollBeyondLastLine: false,
                automaticLayout: true,
                folding: true,
                lineNumbers: false,
                wordWrap: 'on',
              }}
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex flex-col gap-5">{children}</div>
    </div>
  );
};
