import {Popover, PopoverTrigger, Button, PopoverContent} from '@sqlrooms/ui';
import {TriangleAlertIcon} from 'lucide-react';
import React from 'react';

/**
 * Displays a compact, reusable popover with a warning icon and error details.
 * Intended for tool rendering/processing errors to keep UIs consistent.
 */
export interface ToolErrorMessageProps {
  /**
   * Error object or message to display inside the popover body.
   */
  error?: unknown;
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
}

export function ToolErrorMessage(props: ToolErrorMessageProps) {
  const title = props.title ?? 'Tool rendering error';
  const triggerLabel = props.triggerLabel ?? 'Tool rendering failed';
  const align = props.align ?? 'start';
  const errorText = props.error != null ? String(props.error) : '';

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button className="w-fit" variant="ghost" size="xs">
          <p className="flex items-center gap-2 text-xs text-orange-500">
            <TriangleAlertIcon />
            {triggerLabel}
          </p>
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align}>
        <div className="flex flex-col gap-2">
          <div className="border-b text-sm font-medium text-orange-500">
            {title}
          </div>
          {errorText ? (
            <div className="whitespace-pre-wrap font-mono text-xs text-orange-500">
              {errorText}
            </div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
