import {JsonMonacoEditor} from '@sqlrooms/monaco-editor';
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useDisclosure,
} from '@sqlrooms/ui';
import {TriangleAlertIcon} from 'lucide-react';
import React, {memo, useMemo} from 'react';

type TabKey = 'error' | 'details';

interface ToolErrorMessageContentProps {
  title: string;
  errorText: string;
  details?: string | object;
  editorHeightPx: number;
}

const ToolErrorMessageContent = memo(
  ({
    title,
    errorText,
    details,
    editorHeightPx,
  }: ToolErrorMessageContentProps) => {
    const hasErrorText = errorText.length > 0;
    const hasDetails = details != null;

    const defaultTab: TabKey = hasErrorText ? 'error' : 'details';

    return (
      <Tabs defaultValue={defaultTab}>
        <TabsList className="mb-2 h-8 gap-1">
          {hasErrorText && (
            <TabsTrigger value="error" className="h-6 px-2 text-xs">
              {title}
            </TabsTrigger>
          )}
          {hasDetails && (
            <TabsTrigger value="details" className="h-6 px-2 text-xs">
              Details
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="error" className="mt-0">
          <div className="max-h-[300px] overflow-auto whitespace-pre-wrap font-mono text-xs">
            {errorText}
          </div>
        </TabsContent>

        <TabsContent value="details" className="mt-0">
          <div
            className="w-full overflow-hidden rounded-md border"
            style={{height: editorHeightPx}}
          >
            <JsonMonacoEditor
              className="h-full"
              value={details}
              readOnly
              options={{
                lineNumbers: 'off',
                minimap: {enabled: false},
                scrollBeyondLastLine: false,
                wordWrap: 'on',
              }}
            />
          </div>
        </TabsContent>
      </Tabs>
    );
  },
);

ToolErrorMessageContent.displayName = 'ToolErrorMessageContent';

export interface ToolErrorMessageProps {
  error?: unknown;
  details?: string | object;
  title?: string;
  triggerLabel?: string;
  align?: 'start' | 'center' | 'end';
  editorHeightPx?: number;
}

export function ToolErrorMessage({
  error,
  details,
  title = 'Tool call error',
  triggerLabel = 'Tool rendering failed',
  align = 'start',
  editorHeightPx = 300,
}: ToolErrorMessageProps) {
  const popover = useDisclosure();

  const errorText = useMemo(
    () => (error != null ? String(error) : ''),
    [error],
  );

  return (
    <Popover open={popover.isOpen} onOpenChange={popover.onToggle}>
      <PopoverTrigger asChild>
        <Button
          className="w-fit"
          variant="ghost"
          size="xs"
          aria-label={triggerLabel}
        >
          <TriangleAlertIcon />
        </Button>
      </PopoverTrigger>

      {popover.isOpen && (
        <PopoverContent align={align} className="w-[600px] max-w-[80vw]">
          <ToolErrorMessageContent
            title={title}
            errorText={errorText}
            details={details}
            editorHeightPx={editorHeightPx}
          />
        </PopoverContent>
      )}
    </Popover>
  );
}
