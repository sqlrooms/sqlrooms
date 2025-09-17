import {Button, cn, Spinner, Textarea} from '@sqlrooms/ui';
import {ArrowUpIcon, OctagonXIcon} from 'lucide-react';
import {PropsWithChildren, useCallback, useRef, useEffect} from 'react';
import {useStoreWithAi} from '../AiSlice';
import {useChat} from '@ai-sdk/react';
import {convertToModelMessages, DefaultChatTransport, streamText} from 'ai';
import {createOpenAI} from '@ai-sdk/openai';

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type QueryControlsProps = PropsWithChildren<{
  className?: string;
  placeholder?: string;
  onRun?: () => void;
  onCancel?: () => void;
}>;

export const QueryControls: React.FC<QueryControlsProps> = ({
  className,
  placeholder = 'What would you like to learn about the data?',
  children,
  onRun,
  onCancel,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isRunningAnalysis = useStoreWithAi((s) => s.ai.isRunningAnalysis);
  const runAnalysis = useStoreWithAi((s) => s.ai.startAnalysis);
  const cancelAnalysis = useStoreWithAi((s) => s.ai.cancelAnalysis);
  const analysisPrompt = useStoreWithAi((s) => s.ai.analysisPrompt);
  const isDataAvailable = useStoreWithAi((s) => s.room.isDataAvailable);
  const setAnalysisPrompt = useStoreWithAi((s) => s.ai.setAnalysisPrompt);
  const currentSession = useStoreWithAi((s) => s.ai.getCurrentSession());
  const model = currentSession?.model;

  useEffect(() => {
    if (!isDataAvailable) return;
    // Focus the textarea when the component mounts
    // Using a small timeout ensures the data is loaded and
    // add timeout to prevent aria hidden warning caused by the
    // loading progress dialog being still open
    const timer = setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [isDataAvailable]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (
        e.key === 'Enter' &&
        !e.shiftKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.metaKey
      ) {
        e.preventDefault();
        if (!isRunningAnalysis && model && analysisPrompt.trim().length) {
          runAnalysis();
        }
      }
    },
    [isRunningAnalysis, model, analysisPrompt, runAnalysis],
  );

  const canStart = Boolean(model && analysisPrompt.trim().length);

  const handleClickRunOrCancel = useCallback(() => {
    if (isRunningAnalysis) {
      cancelAnalysis();
      onCancel?.();
    } else {
      runAnalysis();
      onRun?.();
    }
  }, [isRunningAnalysis, cancelAnalysis, runAnalysis]);

  // Custom fetch function that handles the AI processing locally
  const customFetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
    const m = JSON.parse(init?.body as string);

    const result = streamText({
      model: openai('gpt-4.1'),
      messages: convertToModelMessages(m.messages),
      tools: {},
      system: '',
      abortSignal: init?.signal as AbortSignal | undefined,
    });
    return result.toUIMessageStreamResponse();
  };

  const {error, messages, sendMessage, addToolResult} = useChat({
    transport: new DefaultChatTransport({
      fetch: customFetch,
    }),
    // local tools are handled by the client
    onToolCall: async ({toolCall}) => {
      // In Vercel AI v5, the toolCall structure might have changed
      // We can check if it's the localQuery tool by checking the tool name or type
      const toolName =
        (toolCall as any).toolName || (toolCall as any).name || 'unknown';
      if (toolName === 'localQuery') {
        const args = toolCall.input as Record<string, unknown>;
        const result = await localQueryTool.execute?.(args, {
          toolCallId: toolCall.toolCallId,
        });
        addToolResult({
          tool: 'localQuery',
          toolCallId: toolCall.toolCallId,
          output: result,
        });
        console.log('result', result);
      }
    },
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  });

  return (
    <div
      className={cn(
        'flex w-full flex-col items-center justify-center gap-4',
        className,
      )}
    >
      <div className="bg-muted/50 flex h-full w-full flex-row items-center gap-2 rounded-md border">
        <div className="flex w-full flex-col gap-1 overflow-hidden">
          <Textarea
            ref={textareaRef}
            disabled={isRunningAnalysis}
            className="min-h-[30px] resize-none border-none p-2 text-sm outline-none focus-visible:ring-0"
            autoResize
            value={analysisPrompt}
            onChange={(e) => setAnalysisPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            autoFocus
          />
          <div className="align-stretch flex w-full items-center gap-2 overflow-hidden">
            <div className="flex h-full w-full min-w-0 items-center gap-2 overflow-hidden">
              <div className="min-w-0 flex-1 overflow-hidden pl-2">
                <div className="flex flex-nowrap items-center gap-2 overflow-x-auto py-1">
                  {children}
                </div>
              </div>
              <div className="ml-auto shrink-0 pr-2">
                <Button
                  className="h-8 w-8 rounded-full"
                  variant="default"
                  size="icon"
                  onClick={handleClickRunOrCancel}
                  disabled={!canStart}
                >
                  {isRunningAnalysis ? <OctagonXIcon /> : <ArrowUpIcon />}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
