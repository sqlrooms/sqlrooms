import {Button, cn, Textarea} from '@sqlrooms/ui';
import {ArrowUpIcon, OctagonXIcon} from 'lucide-react';
import {useCallback, useRef, type MouseEvent, type ReactNode} from 'react';
import {Input, Send, Stop, useChatComposer} from '../composer';
import {ComposerFooterStrip} from './ComposerFooterStrip';
import {
  ContextDropTarget,
  type ContextDropTargetConfig,
} from './ContextDropTarget';
import {useDelayedFocus} from './useDelayedFocus';

export type ComposerFrameProps = {
  className?: string;
  placeholder: string;
  /** Disables the prompt textarea. Each runtime mode decides when. */
  disabled?: boolean;
  dropTarget?: ContextDropTargetConfig;
  /** Rendered above the textarea — context selectors and host actions. */
  topRow?: ReactNode;
  /** Covers the whole frame, e.g. a busy state. Positioned by the caller. */
  overlay?: ReactNode;
  /** Chips in the scrolling footer strip. */
  footerStart?: ReactNode;
  /** Controls between the footer chips and the send/stop buttons. */
  footerEnd?: ReactNode;
  onRun?: (prompt?: string) => void | false;
  onCancel?: () => void;
};

/**
 * The composer's box, textarea, and footer — pure layout over the composer
 * primitives. Carries no knowledge of runtime modes: callers pass their own
 * chrome through the slots and read their own state.
 */
export function ComposerFrame({
  className,
  placeholder,
  disabled,
  dropTarget,
  topRow,
  overlay,
  footerStart,
  footerEnd,
  onRun,
  onCancel,
}: ComposerFrameProps) {
  const composer = useChatComposer();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useDelayedFocus(textareaRef);

  // Runs before a session is created, so a host can create artifacts first.
  // Wired through the primitives' `onBeforeSend` seam rather than duplicating
  // their Enter/click guards here.
  const handleBeforeSend = useCallback(
    (text: string) => onRun?.(text) !== false,
    [onRun],
  );

  const handleStopClick = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      composer.cancel();
      onCancel?.();
      e.preventDefault();
    },
    [composer, onCancel],
  );

  return (
    <div
      className={cn(
        'relative flex w-full flex-col items-center justify-center gap-2',
        className,
      )}
    >
      {overlay}
      <ContextDropTarget target={dropTarget}>
        {({setNodeRef, isAcceptedOver}) => (
          <div
            ref={setNodeRef}
            className={cn(
              'bg-muted/50 flex h-full w-full flex-row items-center gap-2 rounded-md border transition-all',
              isAcceptedOver &&
                'border-primary/70 bg-primary/10 ring-primary/35 shadow-primary/10 shadow-sm ring-2',
            )}
          >
            <div className="flex w-full flex-col gap-1 overflow-hidden">
              {topRow}
              <Input
                ref={textareaRef}
                asChild
                autoResize={false}
                disabled={disabled}
                placeholder={placeholder}
                autoFocus
                onBeforeSend={handleBeforeSend}
              >
                <Textarea
                  className="max-h-[min(300px,40vh)] min-h-[30px] resize-none border-none p-2 text-sm outline-hidden focus-visible:ring-0"
                  autoResize
                />
              </Input>
              <ComposerFooterStrip
                actions={
                  <div className="ml-auto flex shrink-0 items-center gap-1 p-2">
                    {footerEnd}
                    <Send asChild onBeforeSend={handleBeforeSend}>
                      <Button
                        className="h-8 w-8 rounded-full"
                        variant="default"
                        size="icon"
                      >
                        <ArrowUpIcon />
                      </Button>
                    </Send>
                    <Stop asChild onClick={handleStopClick}>
                      <Button
                        className="h-8 w-8 rounded-full"
                        variant="default"
                        size="icon"
                      >
                        <OctagonXIcon />
                      </Button>
                    </Stop>
                  </div>
                }
              >
                {footerStart}
              </ComposerFooterStrip>
            </div>
          </div>
        )}
      </ContextDropTarget>
    </div>
  );
}
