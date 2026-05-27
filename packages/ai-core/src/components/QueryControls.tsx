import {DragEndEvent, useDndMonitor, useDroppable} from '@dnd-kit/core';
import {Button, cn, Textarea} from '@sqlrooms/ui';
import {ArrowUpIcon, LoaderCircleIcon, OctagonXIcon} from 'lucide-react';
import {
  PropsWithChildren,
  useCallback,
  useEffect,
  useState,
  Children,
  isValidElement,
  ReactNode,
  Ref,
  useRef,
  useMemo,
} from 'react';
import {useStoreWithAi} from '../AiSlice';
import {CHAT_CONTEXT_SELECTOR_SLOT, ContextSelector} from './ContextSelector';
import {ContextUsageIndicator} from './ContextUsageIndicator';
import {InlineApiKeyInput, InlineApiKeyInputButton} from './InlineApiKeyInput';
import {hasAiSettingsConfig} from '../hasAiSettingsConfig';
import {extractModelsFromSettings} from '../utils';

type QueryControlsProps = PropsWithChildren<{
  className?: string;
  placeholder?: string;
  onRun?: () => void;
  onCancel?: () => void;
  contextDropTarget?: {
    id: string;
    canAccept: (data: unknown) => boolean;
    onDrop: (data: unknown) => void;
  };
}>;

type ContextDropTargetConfig = NonNullable<
  QueryControlsProps['contextDropTarget']
>;

type ContextDropTargetRenderArgs = {
  isAcceptedOver: boolean;
  setNodeRef?: Ref<HTMLDivElement>;
};

/**
 * Checks if a child is an InlineApiKeyInput component
 */
function isInlineApiKeyInput(
  child: ReactNode,
): child is React.ReactElement<React.ComponentProps<typeof InlineApiKeyInput>> {
  return isValidElement(child) && child.type === InlineApiKeyInput;
}

function isContextSelector(
  child: ReactNode,
): child is React.ReactElement<React.ComponentProps<typeof ContextSelector>> {
  if (!isValidElement(child)) return false;
  if (child.type === ContextSelector) return true;
  return (
    typeof child.type !== 'string' &&
    Boolean(
      (child.type as {[CHAT_CONTEXT_SELECTOR_SLOT]?: boolean})[
        CHAT_CONTEXT_SELECTOR_SLOT
      ],
    )
  );
}

/**
 * Extracts special composer children and returns the rest.
 */
function extractComposerChildren(children: ReactNode): {
  inlineApiKeyInput: React.ReactElement<
    React.ComponentProps<typeof InlineApiKeyInput>
  > | null;
  contextSelectors: ReactNode[];
  otherChildren: ReactNode[];
} {
  let inlineApiKeyInput: React.ReactElement<
    React.ComponentProps<typeof InlineApiKeyInput>
  > | null = null;
  const contextSelectors: ReactNode[] = [];
  const otherChildren: ReactNode[] = [];

  Children.forEach(children, (child) => {
    if (isInlineApiKeyInput(child)) {
      inlineApiKeyInput = child;
    } else if (isContextSelector(child)) {
      contextSelectors.push(child);
    } else {
      otherChildren.push(child);
    }
  });

  return {inlineApiKeyInput, contextSelectors, otherChildren};
}

export const QueryControls: React.FC<QueryControlsProps> = ({
  className,
  placeholder = 'What would you like to learn about the data?',
  children,
  onRun,
  onCancel,
  contextDropTarget,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentSession = useStoreWithAi((s) => s.ai.getCurrentSession());
  const sessionId = currentSession?.id;
  const model = currentSession?.model;
  const modelProvider = currentSession?.modelProvider;

  const apiKey = useStoreWithAi((s) => s.ai.getApiKeyFromSettings());
  const hasApiKeyError = useStoreWithAi((s) => s.ai.hasApiKeyError());
  const aiSettingsConfig = useStoreWithAi((s) =>
    hasAiSettingsConfig(s) ? s.aiSettings.config : undefined,
  );
  const settingsModels = useMemo(
    () => (aiSettingsConfig ? extractModelsFromSettings(aiSettingsConfig) : []),
    [aiSettingsConfig],
  );
  const hasSelectedModel = aiSettingsConfig
    ? settingsModels.some(
        (candidate) =>
          candidate.provider === modelProvider && candidate.value === model,
      )
    : Boolean(modelProvider && model);

  // Extract special composer controls from children
  const {inlineApiKeyInput, contextSelectors, otherChildren} =
    extractComposerChildren(children);

  // Show API key input if InlineApiKeyInput is provided and either:
  // - No API key is set, OR
  // - There's an API key error (invalid key)
  const showApiKeyInput =
    inlineApiKeyInput !== null &&
    hasSelectedModel &&
    (!apiKey || apiKey.trim().length === 0 || hasApiKeyError);

  const isRunning = useStoreWithAi((s) =>
    sessionId ? s.ai.getIsRunning(sessionId) : false,
  );
  const isSummarizing = useStoreWithAi((s) => s.ai.isSummarizing);
  const prompt = useStoreWithAi((s) =>
    sessionId ? s.ai.getPrompt(sessionId) : '',
  );
  const setPrompt = useStoreWithAi((s) => s.ai.setPrompt);
  const runAnalysis = useStoreWithAi((s) => s.ai.startAnalysis);
  const cancelAnalysis = useStoreWithAi((s) => s.ai.cancelAnalysis);

  useEffect(() => {
    if (showApiKeyInput) return;
    const timer = setTimeout(() => {
      textareaRef.current?.focus();
    }, 500);
    return () => clearTimeout(timer);
  }, [showApiKeyInput]);

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
        if (
          !isSummarizing &&
          !isRunning &&
          sessionId &&
          hasSelectedModel &&
          prompt.trim().length
        ) {
          runAnalysis(sessionId);
        }
      }
    },
    [
      isSummarizing,
      isRunning,
      sessionId,
      hasSelectedModel,
      prompt,
      runAnalysis,
    ],
  );

  const canStart = Boolean(
    sessionId && hasSelectedModel && prompt.trim().length,
  );

  const handleClickRunOrCancel = useCallback(() => {
    if (!sessionId) return;
    if (isRunning) {
      cancelAnalysis(sessionId);
      onCancel?.();
    } else {
      runAnalysis(sessionId);
      onRun?.();
    }
  }, [sessionId, isRunning, cancelAnalysis, onCancel, runAnalysis, onRun]);

  // Render the API key input mode
  if (showApiKeyInput && inlineApiKeyInput) {
    return (
      <div
        className={cn(
          'flex w-full flex-col items-center justify-center gap-2',
          className,
        )}
      >
        <div className="bg-muted/50 flex h-full w-full flex-row items-center gap-2 rounded-md border">
          <div className="flex w-full flex-col gap-1 overflow-hidden">
            {/* Render the InlineApiKeyInput which provides Input + Button */}
            <InlineApiKeyInputRenderer inlineApiKeyInput={inlineApiKeyInput}>
              {otherChildren}
            </InlineApiKeyInputRenderer>
          </div>
        </div>
      </div>
    );
  }

  // Render the normal prompt mode
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
      <OptionalContextDropTarget target={contextDropTarget}>
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
              {contextSelectors.length > 0 ? (
                <div className="flex w-full flex-wrap items-center gap-1 px-2 pt-2">
                  {contextSelectors}
                </div>
              ) : null}
              <Textarea
                ref={textareaRef}
                className="max-h-[min(300px,40vh)] min-h-[30px] resize-none border-none p-2 text-sm outline-hidden focus-visible:ring-0"
                autoResize
                value={prompt}
                disabled={isSummarizing}
                onChange={(e) => {
                  if (sessionId) {
                    setPrompt(sessionId, e.target.value);
                  }
                }}
                onKeyDown={handleKeyDown}
                placeholder={
                  hasSelectedModel ? placeholder : 'No model selected'
                }
                autoFocus
              />
              <div className="align-stretch flex w-full items-center gap-2 overflow-hidden">
                <div className="flex h-full w-full min-w-0 items-center gap-2 overflow-hidden">
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <div className="flex flex-nowrap items-center gap-2 overflow-x-auto py-1 pl-2">
                      {otherChildren}
                    </div>
                  </div>
                  <div className="ml-auto flex shrink-0 items-center gap-1 p-2">
                    <ContextUsageIndicator />
                    <Button
                      className="h-8 w-8 rounded-full"
                      variant="default"
                      size="icon"
                      onClick={handleClickRunOrCancel}
                      disabled={isSummarizing || (!isRunning && !canStart)}
                    >
                      {isRunning ? <OctagonXIcon /> : <ArrowUpIcon />}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </OptionalContextDropTarget>
    </div>
  );
};

function OptionalContextDropTarget({
  target,
  children,
}: {
  target?: ContextDropTargetConfig;
  children: (args: ContextDropTargetRenderArgs) => ReactNode;
}) {
  if (!target) {
    return children({setNodeRef: undefined, isAcceptedOver: false});
  }

  return <ContextDropTarget target={target}>{children}</ContextDropTarget>;
}

function ContextDropTarget({
  target,
  children,
}: {
  target: ContextDropTargetConfig;
  children: (args: ContextDropTargetRenderArgs) => ReactNode;
}) {
  const {active, isOver, setNodeRef} = useDroppable({
    id: target.id,
    data: {roomDndPriority: 100},
  });
  const activeDropData = active?.data.current;
  const isAcceptedOver = Boolean(
    isOver && activeDropData && target.canAccept(activeDropData),
  );

  const isPointerWithinTarget = useCallback(
    (event: DragEndEvent) =>
      Boolean(
        event.collisions?.some(
          (collision) =>
            collision.id === target.id &&
            collision.data?.pointerWithin === true,
        ),
      ),
    [target.id],
  );

  useDndMonitor({
    onDragEnd: (event) => {
      if (event.over?.id !== target.id || !isPointerWithinTarget(event)) {
        return;
      }
      const data = event.active.data.current;
      if (target.canAccept(data)) {
        target.onDrop(data);
      }
    },
  });

  return children({setNodeRef, isAcceptedOver});
}

/**
 * Internal component that renders the InlineApiKeyInput with proper layout
 */
const InlineApiKeyInputRenderer: React.FC<{
  inlineApiKeyInput: React.ReactElement<
    React.ComponentProps<typeof InlineApiKeyInput>
  >;
  children: ReactNode;
}> = ({inlineApiKeyInput, children}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');

  const modelProvider = useStoreWithAi(
    (s) => s.ai.getCurrentSession()?.modelProvider,
  );
  const setApiKeyError = useStoreWithAi((s) => s.ai.setApiKeyError);

  const {onSaveApiKey} = inlineApiKeyInput.props;

  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const handleSaveKey = useCallback(
    (provider: string, apiKey: string) => {
      // Clear the API key error for this provider when saving a new key
      setApiKeyError(provider, false);
      onSaveApiKey(provider, apiKey);
    },
    [onSaveApiKey, setApiKeyError],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (
        e.key === 'Enter' &&
        !e.shiftKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.metaKey
      ) {
        e.preventDefault();
        if (apiKeyInput.trim() && modelProvider) {
          handleSaveKey(modelProvider, apiKeyInput.trim());
          setApiKeyInput('');
        }
      }
    },
    [apiKeyInput, modelProvider, handleSaveKey],
  );

  const handleSave = useCallback(() => {
    if (apiKeyInput.trim() && modelProvider) {
      handleSaveKey(modelProvider, apiKeyInput.trim());
      setApiKeyInput('');
    }
  }, [apiKeyInput, modelProvider, handleSaveKey]);

  const canSave = Boolean(apiKeyInput.trim().length && modelProvider);

  const formatProviderLabel = (provider: string) =>
    provider.toLowerCase() === 'openai'
      ? 'OpenAI'
      : provider.charAt(0).toUpperCase() + provider.slice(1);

  return (
    <>
      <input
        ref={inputRef}
        type="password"
        className="min-h-[30px] flex-1 border-none bg-transparent p-2 text-sm outline-none focus-visible:ring-0"
        value={apiKeyInput}
        onChange={(e) => setApiKeyInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={
          modelProvider
            ? `Enter your ${formatProviderLabel(modelProvider)} API key...`
            : 'No model selected'
        }
        autoFocus
        autoComplete="off"
      />
      <div className="align-stretch flex w-full items-center gap-2 overflow-hidden">
        <div className="flex h-full w-full min-w-0 items-center gap-2 overflow-hidden">
          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="flex flex-nowrap items-center gap-2 overflow-x-auto py-1 pl-2">
              {children}
            </div>
          </div>
          <div className="ml-auto shrink-0 gap-2 p-2">
            <InlineApiKeyInputButton onSave={handleSave} disabled={!canSave} />
          </div>
        </div>
      </div>
    </>
  );
};
