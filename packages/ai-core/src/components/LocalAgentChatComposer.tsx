import {Button, cn, Textarea} from '@sqlrooms/ui';
import {ArrowUpIcon, OctagonXIcon} from 'lucide-react';
import {useCallback, type FC, type KeyboardEvent, type ReactNode} from 'react';
import {useChatRuntime} from './ChatRuntimeContext';

export type LocalAgentChatComposerProps = {
  className?: string;
  placeholder?: string;
  onRun?: () => void;
  onCancel?: () => void;
  children?: ReactNode;
};

export const LocalAgentChatComposer: FC<LocalAgentChatComposerProps> = ({
  className,
  placeholder = 'Message...',
  onRun,
  onCancel,
  children,
}) => {
  const runtime = useChatRuntime();

  const handleSend = useCallback(() => {
    if (runtime.mode !== 'local-agent') return;
    runtime.sendPrompt();
    onRun?.();
  }, [onRun, runtime]);

  const handleStop = useCallback(() => {
    if (runtime.mode !== 'local-agent') return;
    runtime.stop();
    onCancel?.();
  }, [onCancel, runtime]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (
        e.key === 'Enter' &&
        !e.shiftKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.metaKey
      ) {
        e.preventDefault();
        if (runtime.mode !== 'local-agent') return;
        if (runtime.isStreaming) {
          handleStop();
          return;
        }
        if (runtime.prompt.trim().length > 0) {
          handleSend();
        }
      }
    },
    [handleSend, handleStop, runtime],
  );

  if (runtime.mode !== 'local-agent') return null;

  const canStart = runtime.prompt.trim().length > 0;

  return (
    <div
      className={cn(
        'relative flex w-full flex-col items-center justify-center gap-2',
        className,
      )}
    >
      <div className="bg-muted/50 flex h-full w-full flex-row items-center gap-2 rounded-md border transition-all">
        <div className="flex w-full flex-col gap-1 overflow-hidden">
          <Textarea
            className="max-h-[min(300px,40vh)] min-h-[30px] resize-none border-none p-2 text-sm outline-hidden focus-visible:ring-0"
            autoResize
            value={runtime.prompt}
            disabled={runtime.isStreaming}
            onChange={(e) => runtime.setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            autoFocus
          />
          <div className="align-stretch flex w-full items-center gap-2 overflow-hidden">
            <div className="flex h-full w-full min-w-0 items-center gap-2 overflow-hidden">
              <div className="min-w-0 flex-1 overflow-hidden">
                <div className="flex flex-nowrap items-center gap-2 overflow-x-auto py-1 pl-2">
                  {children}
                </div>
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-1 p-2">
                <Button
                  className="h-8 w-8 rounded-full"
                  variant="default"
                  size="icon"
                  type="button"
                  onClick={runtime.isStreaming ? handleStop : handleSend}
                  disabled={!runtime.isStreaming && !canStart}
                >
                  {runtime.isStreaming ? <OctagonXIcon /> : <ArrowUpIcon />}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
