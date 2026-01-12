import {JsonMonacoEditor} from '@sqlrooms/monaco-editor';
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  useDisclosure,
} from '@sqlrooms/ui';
import {TriangleAlertIcon} from 'lucide-react';

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
   * Defaults to "Tool rendering error".
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
  const title = props.title ?? 'Tool rendering error';
  const align = props.align ?? 'start';
  const errorText = props.error != null ? String(props.error) : '';
  const editorHeightPx = props.editorHeightPx ?? 300;
  const hasDetails = props.details != null;
  const popoverOpen = useDisclosure();

  return (
    <Popover open={popoverOpen.isOpen} onOpenChange={popoverOpen.onToggle}>
      <PopoverTrigger asChild>
        <Button className="w-fit" variant="ghost" size="xs">
          <TriangleAlertIcon />
        </Button>
      </PopoverTrigger>
      {popoverOpen.isOpen ? (
        <PopoverContent align={align} style={{width: '600px', maxWidth: '80%'}}>
          <div className="flex flex-col gap-2">
            <div className="border-b text-sm font-medium">{title}</div>

            {errorText ? (
              <div className="font-mono text-xs whitespace-pre-wrap">
                {errorText}
              </div>
            ) : null}

            {hasDetails ? (
              <div
                className="w-full overflow-hidden rounded-md border"
                style={{height: editorHeightPx}}
              >
                <JsonMonacoEditor
                  className="h-full"
                  value={
                    props.details as unknown as object | string | undefined
                  }
                  readOnly={true}
                  options={{
                    lineNumbers: 'off',
                    minimap: {enabled: false},
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                  }}
                />
              </div>
            ) : null}
          </div>
        </PopoverContent>
      ) : null}
    </Popover>
  );
}
