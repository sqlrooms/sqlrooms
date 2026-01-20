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
import React from 'react';

function ToolErrorMessageContent({
  title,
  errorText,
  details,
  editorHeightPx,
}: {
  title: string;
  errorText: string;
  details: string | object | undefined;
  editorHeightPx: number;
}) {
  const hasDetails = details != null;
  const hasErrorText = errorText.length > 0;

  const tabCount = Number(hasErrorText) + Number(hasDetails);
  const showTabs = tabCount > 1;

  const [activeTab, setActiveTab] = React.useState<'error' | 'details'>(
    hasErrorText ? 'error' : 'details',
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="border-b text-sm font-medium">{title}</div>

      {tabCount === 0 ? null : !showTabs ? (
        hasErrorText ? (
          <div className="max-h-[300px] overflow-auto font-mono text-xs whitespace-pre-wrap">
            {errorText}
          </div>
        ) : (
          <div
            className="w-full overflow-hidden rounded-md border"
            style={{height: editorHeightPx}}
          >
            <JsonMonacoEditor
              className="h-full"
              value={details as unknown as object | string | undefined}
              readOnly={true}
              options={{
                lineNumbers: 'off',
                minimap: {enabled: false},
                scrollBeyondLastLine: false,
                wordWrap: 'on',
              }}
            />
          </div>
        )
      ) : (
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as 'error' | 'details')}
        >
          <TabsList className="h-8">
            {hasErrorText ? (
              <TabsTrigger value="error" className="h-6 px-2 text-xs">
                Error text
              </TabsTrigger>
            ) : null}
            {hasDetails ? (
              <TabsTrigger value="details" className="h-6 px-2 text-xs">
                Full tool call
              </TabsTrigger>
            ) : null}
          </TabsList>

          {hasErrorText ? (
            <TabsContent value="error" className="mt-0">
              <div className="max-h-[300px] overflow-auto font-mono text-xs whitespace-pre-wrap">
                {errorText}
              </div>
            </TabsContent>
          ) : null}

          {hasDetails ? (
            <TabsContent value="details" className="mt-0">
              <div
                className="w-full overflow-hidden rounded-md border"
                style={{height: editorHeightPx}}
              >
                {activeTab === 'details' ? (
                  <JsonMonacoEditor
                    className="h-full"
                    value={details as unknown as object | string | undefined}
                    readOnly={true}
                    options={{
                      lineNumbers: 'off',
                      minimap: {enabled: false},
                      scrollBeyondLastLine: false,
                      wordWrap: 'on',
                    }}
                  />
                ) : null}
              </div>
            </TabsContent>
          ) : null}
        </Tabs>
      )}
    </div>
  );
}

/**
 * Displays a compact, reusable popover with a warning icon and error details.
 * Intended for tool rendering/processing errors to keep UIs consistent.
 *
 * The popover is controllable to optimize performance by only rendering the
 * JsonMonacoEditor when the popover is actually open.
 */
export interface ToolErrorMessageProps {
  /**
   * Error object or message to display inside the popover body.
   */
  error?: unknown;
  /**
   * Optional structured details to render in a Monaco JSON editor.
   */
  details?: string | object;
  /**
   * Header text shown at the top of the popover.
   * Defaults to "Tool call error".
   */
  title?: string;
  /**
   * Label shown next to the warning icon in the trigger button.
   * Defaults to "Tool rendering failed".
   */
  triggerLabel?: string;
  /**
   * Alignment of the popover content relative to its trigger.
   * Defaults to "start".
   */
  align?: 'start' | 'center' | 'end';
  /**
   * Height for the embedded editor when details are provided.
   * Defaults to 300px.
   */
  editorHeightPx?: number;
}

export function ToolErrorMessage(props: ToolErrorMessageProps) {
  const title = props.title ?? 'Tool call error';
  const align = props.align ?? 'start';
  const errorText = props.error != null ? String(props.error) : '';
  const editorHeightPx = props.editorHeightPx ?? 300;
  const popoverOpen = useDisclosure();

  if (!popoverOpen.isOpen) {
    return (
      <Popover open={popoverOpen.isOpen} onOpenChange={popoverOpen.onToggle}>
        <PopoverTrigger asChild>
          <Button className="w-fit" variant="ghost" size="xs">
            <TriangleAlertIcon />
          </Button>
        </PopoverTrigger>
      </Popover>
    );
  }

  return (
    <Popover open={popoverOpen.isOpen} onOpenChange={popoverOpen.onToggle}>
      <PopoverTrigger asChild>
        <Button className="w-fit" variant="ghost" size="xs">
          <TriangleAlertIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-[600px] max-w-[80vw]">
        <ToolErrorMessageContent
          title={title}
          errorText={errorText}
          details={props.details}
          editorHeightPx={editorHeightPx}
        />
      </PopoverContent>
    </Popover>
  );
}
