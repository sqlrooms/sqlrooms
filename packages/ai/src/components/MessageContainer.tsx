import {JsonMonacoEditor} from '@sqlrooms/monaco-editor';
import {
  Badge,
  Button,
  cn,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@sqlrooms/ui';
import {CheckCircle2Icon, CodeIcon, XCircleIcon} from 'lucide-react';

type MessageContainerProps = {
  isSuccess: boolean;
  borderColor: string;
  title: string;
  content: object;
  children: React.ReactNode;
};

export const MessageContainer: React.FC<MessageContainerProps> = ({
  isSuccess,
  borderColor,
  title,
  content,
  children,
}) => {
  return (
    <div
      className={cn(
        'border-2 relative bg-gray-100 dark:bg-gray-900 px-5 py-6 rounded-md text-gray-700 dark:text-gray-300 text-xs',
        isSuccess ? borderColor : 'border-red-500',
      )}
    >
      <Badge
        variant="secondary"
        className={cn(
          'text-xs absolute top-[-12px] left-2 dark:text-gray-100 text-gray-700 flex items-center gap-1 border',
          isSuccess ? borderColor : 'border-red-500',
        )}
      >
        {isSuccess ? (
          <CheckCircle2Icon className="w-3 h-3 text-green-500" />
        ) : (
          <XCircleIcon className="w-3 h-3 text-red-500" />
        )}
        {title}
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
              }}
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex flex-col gap-5">{children}</div>
    </div>
  );
};
