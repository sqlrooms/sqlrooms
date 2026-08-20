import {DragEndEvent, useDndMonitor, useDroppable} from '@dnd-kit/core';
import {Button, cn, Textarea} from '@sqlrooms/ui';
import {ArrowUpIcon, LoaderCircleIcon, OctagonXIcon} from 'lucide-react';
import {
  Children,
  isValidElement,
  ReactNode,
  Ref,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FC,
  type KeyboardEvent,
  type MouseEvent,
  type PropsWithChildren,
} from 'react';
import {useStoreWithAi} from '../AiSlice';
import {
  ChatComposerStateBoundary,
  Input,
  Send,
  Stop,
  useChatComposer,
} from './composer';
import {ContextUsageIndicator} from './ContextUsageIndicator';
import {InlineApiKeyInput, InlineApiKeyInputButton} from './InlineApiKeyInput';
import {ContextSelector} from './context/ContextSelector';
import {CHAT_CONTEXT_SELECTOR_SLOT} from './context/types';

type QueryControlsProps = PropsWithChildren<{
  className?: string;
  placeholder?: string;
  /** Actions rendered in the composer's top row, right-aligned next to context controls. */
  topActions?: ReactNode;
  /**
   * Called before creating a session and running analysis.
   * Return false to prevent session creation (useful for custom session management).
   * Receives the prompt text as parameter.
   */
  onRun?: (prompt?: string) => void | false;
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
 * Checks if a child is an InlineApiKeyInput component.
 *
 * @deprecated Part of the child-sniffing routing kept for existing consumers
 * of `QueryControls`. New composers should render the composer primitives
 * (`Chat.Composer.Input`, `.Send`, `.Stop`, `.DropTarget`) directly, and a
 * host wanting a credential gate should branch on `useChatComposer()`'s
 * `needsApiKey` flag instead of relying on this identity check.
 */
function isInlineApiKeyInput(
  child: ReactNode,
): child is React.ReactElement<React.ComponentProps<typeof InlineApiKeyInput>> {
  return isValidElement(child) && child.type === InlineApiKeyInput;
}

/**
 * @deprecated See {@link isInlineApiKeyInput}.
 */
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
 *
 * @deprecated This identity-check-based routing silently breaks when a host
 * wraps a child in `memo`, `lazy`, a fragment, or its own abstraction. It is
 * kept only so existing `QueryControls` consumers keep working unchanged.
 * New composers should use the composer primitives directly instead of
 * relying on `children` being sniffed and routed.
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

/**
 * Renders the shared AI query composer controls.
 *
 * Accepts composer `children`, optional `topActions`, prompt placeholder text,
 * run/cancel handlers, and a context drop target for attached inputs.
 *
 * Composed from {@link useChatComposer} and the composer primitives
 * (`Input`/`Send`/`Stop`), so it works under both `Chat.Root` (session mode) and
 * `Chat.LocalAgentRoot` (local-agent mode) — and, via
 * {@link ChatComposerStateBoundary}, with no `<Chat>` ancestor at all.
 * Session-only chrome (context selectors, the context-usage indicator, the
 * inline API-key mode, and the summarizing overlay) is isolated in a
 * session-only branch and never renders, and never reaches for the AI slice,
 * in local-agent mode.
 */
export const QueryControls: React.FC<QueryControlsProps> = (props) => (
  <ChatComposerStateBoundary>
    <QueryControlsBody {...props} />
  </ChatComposerStateBoundary>
);

function QueryControlsBody(props: QueryControlsProps) {
  const composer = useChatComposer();
  if (composer.mode === 'session') {
    return <SessionQueryControls {...props} />;
  }
  return <LocalAgentQueryControls {...props} />;
}

/**
 * Session-mode composer body. The only place in `QueryControls` that reads
 * the AI slice directly, for the handful of session-only concerns
 * `useChatComposer()` does not normalize: the resolvable-model check (used
 * for the placeholder and the API-key swap), the API key itself, and the
 * summarizing flag.
 */
const SessionQueryControls: FC<QueryControlsProps> = ({
  className,
  placeholder = 'What would you like to learn about the data?',
  children,
  topActions,
  onRun,
  onCancel,
  contextDropTarget,
}) => {
  const apiKey = useStoreWithAi((s) => s.ai.getApiKeyFromSettings());
  const hasApiKeyError = useStoreWithAi((s) => s.ai.hasApiKeyError());
  // Routes through the AI slice's single source of truth for send readiness,
  // which also honors a configured custom-model factory (see
  // `AiSliceState.ai.hasResolvableModel`). `useChatComposer()`'s `canSend`
  // already consumes this same predicate for the send control; it is read
  // again here only for the placeholder text and the API-key swap decision.
  const hasSelectedModel = useStoreWithAi((s) => s.ai.hasResolvableModel());
  const isSummarizing = useStoreWithAi((s) => s.ai.isSummarizing);

  const {inlineApiKeyInput, contextSelectors, otherChildren} =
    extractComposerChildren(children);

  // Show API key input if InlineApiKeyInput is provided and either:
  // - No API key is set, OR
  // - There's an API key error (invalid key)
  const showApiKeyInput =
    inlineApiKeyInput !== null &&
    hasSelectedModel &&
    (!apiKey || apiKey.trim().length === 0 || hasApiKeyError);

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
            <ComposerTopRow
              contextSelectors={contextSelectors}
              topActions={topActions}
            />
            {/* Render the InlineApiKeyInput which provides Input + Button */}
            <InlineApiKeyInputRenderer inlineApiKeyInput={inlineApiKeyInput}>
              {otherChildren}
            </InlineApiKeyInputRenderer>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ComposerFrame
      className={className}
      placeholder={hasSelectedModel ? placeholder : 'No model selected'}
      topActions={topActions}
      contextSelectors={contextSelectors}
      otherChildren={otherChildren}
      contextDropTarget={contextDropTarget}
      textareaDisabled={isSummarizing}
      showContextUsageIndicator
      isSummarizing={isSummarizing}
      onRun={onRun}
      onCancel={onCancel}
    />
  );
};

/**
 * Local-agent-mode composer body. Never reads the AI slice — everything it
 * needs comes from {@link useChatComposer}, which sources local-agent state
 * from the local-agent chat runtime instead.
 */
const LocalAgentQueryControls: FC<QueryControlsProps> = ({
  className,
  placeholder = 'Message...',
  children,
  topActions,
  onRun,
  onCancel,
}) => {
  const composer = useChatComposer();

  return (
    <ComposerFrame
      className={className}
      placeholder={placeholder}
      topActions={topActions}
      contextSelectors={[]}
      otherChildren={children}
      textareaDisabled={composer.isRunning}
      showContextUsageIndicator={false}
      isSummarizing={false}
      onRun={onRun}
      onCancel={onCancel}
    />
  );
};

/**
 * The composer's box, textarea, and footer — shared, unstyled-behavior-wise,
 * by both {@link SessionQueryControls} and {@link LocalAgentQueryControls}.
 * All AI-slice access happens before this component is reached; it only
 * reads {@link useChatComposer}, which is safe in both runtime modes.
 */
function ComposerFrame({
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
}: {
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
}) {
  const composer = useChatComposer();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      textareaRef.current?.focus();
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // Call onRun BEFORE creating a session (allows a host to create artifacts,
  // etc.). This is the composer's pre-send veto, wired through the `Input`
  // and `Send` primitives' `onBeforeSend` seam rather than duplicating their
  // Enter/click guards here.
  const handleBeforeSend = useCallback(
    () => onRun?.(composer.prompt) !== false,
    [composer, onRun],
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
              <div className="align-stretch flex w-full items-center gap-2 overflow-hidden">
                <div className="flex h-full w-full min-w-0 items-center gap-2 overflow-hidden">
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <div className="flex flex-nowrap items-center gap-2 overflow-x-auto py-1 pl-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {otherChildren}
                    </div>
                  </div>
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
                </div>
              </div>
            </div>
          </div>
        )}
      </OptionalContextDropTarget>
    </div>
  );
}

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

function ComposerTopRow({
  contextSelectors,
  topActions,
}: {
  contextSelectors: ReactNode[];
  topActions?: ReactNode;
}) {
  if (contextSelectors.length === 0 && !topActions) {
    return null;
  }

  return (
    <div className="flex w-full items-start gap-2 px-2 pt-2">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
        {contextSelectors}
      </div>
      {topActions ? (
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {topActions}
        </div>
      ) : null}
    </div>
  );
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

  // Use the resolved selection (not the current session's) so first-time key
  // entry works before any session exists: with lazy session creation there is
  // no current session yet, but a provider is still known from the default.
  const modelProvider = useStoreWithAi(
    (s) => s.ai.getSelectedModel().modelProvider,
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
    (e: KeyboardEvent<HTMLInputElement>) => {
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
            <div className="flex flex-nowrap items-center gap-2 overflow-x-auto py-1 pl-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
