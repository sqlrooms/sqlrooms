import {Button, cn, Textarea} from '@sqlrooms/ui';
import {ArrowUpIcon, LoaderCircleIcon, OctagonXIcon} from 'lucide-react';
import {useCallback, useRef, type MouseEvent, type ReactNode} from 'react';
import {Input, Send, Stop, useChatComposer} from '../composer';
import {ContextUsageIndicator} from '../ContextUsageIndicator';
import {ComposerFooterStrip} from './ComposerFooterStrip';
import {ComposerTopRow} from './ComposerTopRow';
import {
  ContextDropTarget,
  type ContextDropTargetConfig,
} from './ContextDropTarget';
import {useDelayedFocus} from './useDelayedFocus';

export type ComposerFrameProps = {
  className?: string;
  placeholder: string;
  topActions?: ReactNode;
  contextSelectors: ReactNode[];
  otherChildren?: ReactNode;
  contextDropTarget?: ContextDropTargetConfig;
  textareaDisabled: boolean;
  showContextUsageIndicator: boolean;
  isSummarizing: boolean;
  onRun?: (prompt?: string) => void | false;
  onCancel?: () => void;
};

/**
 * The composer's box, textarea, and footer, shared by both runtime modes. All
 * AI-slice access happens before this component is reached; it only reads
 * {@link useChatComposer}, which is safe in either mode.
 */
export function ComposerFrame({
  className,
  placeholder,
  topActions,
  contextSelectors,
  otherChildren,
  contextDropTarget,
  textareaDisabled,
  showContextUsageIndicator,
  isSummarizing,
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
      {isSummarizing && (
        <div className="bg-background/70 absolute inset-0 z-10 flex items-center justify-center rounded-md backdrop-blur-sm">
          <LoaderCircleIcon className="text-muted-foreground mr-2 h-4 w-4 animate-spin" />
          <span className="text-muted-foreground text-sm">
            Summarizing conversation…
          </span>
        </div>
      )}
      <ContextDropTarget target={contextDropTarget}>
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
              <ComposerTopRow
                contextSelectors={contextSelectors}
                topActions={topActions}
              />
              <Input
                ref={textareaRef}
                asChild
                autoResize={false}
                disabled={textareaDisabled}
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
                    {showContextUsageIndicator && <ContextUsageIndicator />}
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
                {otherChildren}
              </ComposerFooterStrip>
            </div>
          </div>
        )}
      </ContextDropTarget>
    </div>
  );
}
