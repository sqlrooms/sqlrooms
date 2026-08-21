import {LoaderCircleIcon} from 'lucide-react';
import {type FC, type PropsWithChildren, type ReactNode} from 'react';
import {useStoreWithAi} from '../AiSlice';
import {ChatComposerStateBoundary, useChatComposer} from './composer';
import {ContextUsageIndicator} from './ContextUsageIndicator';
import {ComposerFrame} from './queryControls/ComposerFrame';
import {ComposerTopRow} from './queryControls/ComposerTopRow';
import type {ContextDropTargetConfig} from './queryControls/ContextDropTarget';
import {InlineApiKeyComposer} from './queryControls/InlineApiKeyComposer';
import {extractComposerChildren} from './queryControls/deprecatedChildren';

type QueryControlsProps = PropsWithChildren<{
  className?: string;
  placeholder?: string;
  /** Actions rendered in the composer's top row, right-aligned next to context controls. */
  topActions?: ReactNode;
  /**
   * Called before creating a session and running analysis, with the prompt
   * text. Return `false` to prevent the send (useful for custom session
   * management).
   */
  onRun?: (prompt?: string) => void | false;
  onCancel?: () => void;
  contextDropTarget?: ContextDropTargetConfig;
}>;

/**
 * Renders the shared AI query composer controls.
 *
 * Composed from {@link useChatComposer} and the composer primitives, so it
 * works under both `Chat.Root` (session mode) and `Chat.LocalAgentRoot`
 * (local-agent mode) — and, via {@link ChatComposerStateBoundary}, with no
 * `<Chat>` ancestor at all. Session-only chrome (context selectors, the
 * context-usage indicator, the inline API-key mode, and the summarizing
 * overlay) lives in the session branch and never reaches for the AI slice in
 * local-agent mode.
 */
export const QueryControls: FC<QueryControlsProps> = (props) => (
  <ChatComposerStateBoundary>
    <QueryControlsBody {...props} />
  </ChatComposerStateBoundary>
);

function QueryControlsBody(props: QueryControlsProps) {
  const composer = useChatComposer();
  return composer.mode === 'session' ? (
    <SessionQueryControls {...props} />
  ) : (
    <LocalAgentQueryControls {...props} />
  );
}

/**
 * Session-mode composer. The only place in `QueryControls` that reads the AI
 * slice, for the session-only concerns {@link useChatComposer} does not
 * normalize: the resolvable-model check, the API key, and the summarizing flag.
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
  // The AI slice owns send readiness; `useChatComposer()`'s `canSend` consumes
  // the same predicate. Read here only for the placeholder and the key swap.
  const hasSelectedModel = useStoreWithAi((s) => s.ai.hasResolvableModel());
  const isSummarizing = useStoreWithAi((s) => s.ai.isSummarizing);

  const {inlineApiKeyInput, contextSelectors, otherChildren} =
    extractComposerChildren(children);

  const topRow = (
    <ComposerTopRow
      contextSelectors={contextSelectors}
      topActions={topActions}
    />
  );

  // Swap in key entry when a host supplied the input and no usable key exists.
  const needsKeyEntry =
    inlineApiKeyInput !== null &&
    hasSelectedModel &&
    (!apiKey || apiKey.trim().length === 0 || hasApiKeyError);

  if (needsKeyEntry && inlineApiKeyInput) {
    return (
      <InlineApiKeyComposer
        className={className}
        topRow={topRow}
        inlineApiKeyInput={inlineApiKeyInput}
      >
        {otherChildren}
      </InlineApiKeyComposer>
    );
  }

  return (
    <ComposerFrame
      className={className}
      placeholder={hasSelectedModel ? placeholder : 'No model selected'}
      // Deliberately not `isBusy`: typing stays available during a run, and is
      // blocked only while the conversation is being summarized.
      disabled={isSummarizing}
      dropTarget={contextDropTarget}
      topRow={topRow}
      overlay={isSummarizing ? <SummarizingOverlay /> : null}
      footerStart={otherChildren}
      footerEnd={<ContextUsageIndicator />}
      onRun={onRun}
      onCancel={onCancel}
    />
  );
};

/**
 * Local-agent-mode composer. Never reads the AI slice — everything it needs
 * comes from {@link useChatComposer}.
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
      disabled={composer.isRunning}
      topRow={<ComposerTopRow contextSelectors={[]} topActions={topActions} />}
      footerStart={children}
      onRun={onRun}
      onCancel={onCancel}
    />
  );
};

function SummarizingOverlay() {
  return (
    <div className="bg-background/70 absolute inset-0 z-10 flex items-center justify-center rounded-md backdrop-blur-sm">
      <LoaderCircleIcon className="text-muted-foreground mr-2 h-4 w-4 animate-spin" />
      <span className="text-muted-foreground text-sm">
        Summarizing conversation…
      </span>
    </div>
  );
}
