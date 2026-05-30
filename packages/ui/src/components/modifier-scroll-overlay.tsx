'use client';

import * as React from 'react';
import {cn} from '../lib/utils';

export type ModifierScrollOverlayProps =
  React.HTMLAttributes<HTMLDivElement> & {
    open: boolean;
    modifierLabel: string;
    targetLabel?: string;
    message?: string;
    contentClassName?: string;
  };

function stopPointerEvent(event: React.SyntheticEvent) {
  event.preventDefault();
  event.stopPropagation();
}

export const ModifierScrollOverlay = React.forwardRef<
  HTMLDivElement,
  ModifierScrollOverlayProps
>(
  (
    {
      open,
      modifierLabel,
      targetLabel = 'this area',
      message,
      className,
      contentClassName,
      onPointerDownCapture,
      onPointerUpCapture,
      onClickCapture,
      onDoubleClickCapture,
      onContextMenuCapture,
      ...props
    },
    ref,
  ) => {
    if (!open) return null;

    const label =
      message ?? `Use ${modifierLabel} + scroll to scroll ${targetLabel}`;

    return (
      <div
        ref={ref}
        className={cn(
          'bg-background/70 absolute inset-0 z-20 flex items-center justify-center px-4',
          className,
        )}
        onPointerDownCapture={(event) => {
          stopPointerEvent(event);
          onPointerDownCapture?.(event);
        }}
        onPointerUpCapture={(event) => {
          stopPointerEvent(event);
          onPointerUpCapture?.(event);
        }}
        onClickCapture={(event) => {
          stopPointerEvent(event);
          onClickCapture?.(event);
        }}
        onDoubleClickCapture={(event) => {
          stopPointerEvent(event);
          onDoubleClickCapture?.(event);
        }}
        onContextMenuCapture={(event) => {
          stopPointerEvent(event);
          onContextMenuCapture?.(event);
        }}
        {...props}
      >
        <div
          className={cn(
            'bg-popover/95 text-popover-foreground border-border rounded-md border px-4 py-2 text-sm font-medium shadow-lg',
            contentClassName,
          )}
        >
          {label}
        </div>
      </div>
    );
  },
);
ModifierScrollOverlay.displayName = 'ModifierScrollOverlay';
