import {useCallback, useMemo} from 'react';
import {useStoreWithAi} from '../../AiSlice';
import {
  ChatComposerStateBoundary,
  useChatComposer,
  type ChatComposerMode,
} from '../composer/ChatComposerContext';
import type {LocalAgentChatRuntime} from '../ChatRuntimeContext';
import {createDualModeChatContext} from '../primitives/createDualModeChatContext';

/**
 * Normalized prompt-suggestions state and actions, identical in shape across
 * both chat runtime modes.
 *
 * Read via {@link usePromptSuggestions}. This is the behavior layer: no DOM,
 * no styling. `send` and `isReadyToSend` reuse the composer's own send action
 * and readiness signals, so a suggestion and the send control never disagree.
 */
export interface ChatSuggestionsState {
  /** Which runtime this state was sourced from. */
  mode: ChatComposerMode;
  /** Whether suggestions are currently visible. */
  visible: boolean;
  /** Sets visibility directly. */
  setVisible: (visible: boolean) => void;
  /** Flips visibility. */
  toggle: () => void;
  /**
   * Runtime-supplied suggestion strings, possibly empty. Session mode has no
   * concept of runtime-supplied suggestions and always reports an empty
   * array; local-agent mode reports the root's `initialSuggestions`.
   */
  items: readonly string[];
  /**
   * True when the chat has no messages and no in-progress prompt, in both
   * modes — including a draft typed before any session exists. Branch on this
   * instead of a `when`-style prop.
   */
  isSessionEmpty: boolean;
  /** Writes `text` into the prompt without sending it. */
  fill: (text: string) => void;
  /**
   * Sends `text` immediately, subject to {@link isReadyToSend}. Routed through
   * the composer's `send`, so pre-send vetoes apply.
   */
  send: (text: string) => void;
  /**
   * True when an item's own text could be sent: a model is resolvable
   * (session mode) and nothing is running or summarizing. Built from the same
   * signals as {@link useChatComposer}'s `canSend`, minus its non-empty-prompt
   * requirement, which is the wrong question for an item supplying its own
   * text.
   *
   * Built on `sendBlocked`, not `needsApiKey`: the latter is also true for apps
   * needing no browser key (remote `chatEndPoint`, no ai-settings slice).
   */
  isReadyToSend: boolean;
}

const EMPTY_ITEMS: readonly string[] = [];

/**
 * The only values the two runtime modes actually disagree on. Everything else
 * in {@link ChatSuggestionsState} is derived identically by
 * {@link useSuggestionsState}.
 */
type SuggestionsSource = Pick<
  ChatSuggestionsState,
  'mode' | 'visible' | 'setVisible' | 'items'
> & {
  /**
   * The mode-specific half of send readiness, ANDed with "not busy" by the
   * shared derivation. Session mode requires a resolvable model; local-agent
   * mode has no such concept and always passes `true`.
   */
  hasSendableTarget: boolean;
  /**
   * The message half of {@link ChatSuggestionsState.isSessionEmpty}; the prompt
   * half comes from the composer.
   */
  hasNoMessages: boolean;
};

/**
 * Completes a {@link SuggestionsSource} into full suggestions state, taking
 * `fill`, `send`, and the busy half of readiness from the composer so a
 * suggestion and the send control can never disagree.
 */
function useSuggestionsState(source: SuggestionsSource): ChatSuggestionsState {
  const {mode, visible, setVisible, items, hasSendableTarget, hasNoMessages} =
    source;
  const composer = useChatComposer();

  const toggle = useCallback(() => setVisible(!visible), [visible, setVisible]);
  const fill = useCallback(
    (text: string) => composer.setPrompt(text),
    [composer],
  );
  const send = useCallback((text: string) => composer.send(text), [composer]);

  const isReadyToSend =
    hasSendableTarget && !composer.sendBlocked && !composer.isBusy;
  const isSessionEmpty = hasNoMessages && composer.prompt.trim().length === 0;

  return useMemo(
    () => ({
      mode,
      visible,
      setVisible,
      toggle,
      items,
      isSessionEmpty,
      fill,
      send,
      isReadyToSend,
    }),
    [
      mode,
      visible,
      setVisible,
      toggle,
      items,
      isSessionEmpty,
      fill,
      send,
      isReadyToSend,
    ],
  );
}

/** Session-mode suggestions state: visibility and emptiness from the AI slice. */
function useSessionSuggestionsState(): ChatSuggestionsState {
  const visible = useStoreWithAi((s) => s.ai.promptSuggestionsVisible);
  const setVisible = useStoreWithAi((s) => s.ai.setPromptSuggestionsVisible);
  // Derive inside the selector: the session object is replaced on every
  // streamed token, for a flag that flips once.
  const hasNoMessages = useStoreWithAi(
    (s) => (s.ai.getCurrentSession()?.uiMessages.length ?? 0) === 0,
  );
  const hasResolvableModel = useStoreWithAi((s) => s.ai.hasResolvableModel());

  return useSuggestionsState({
    mode: 'session',
    visible,
    setVisible,
    items: EMPTY_ITEMS,
    hasSendableTarget: hasResolvableModel,
    hasNoMessages,
  });
}

/**
 * Local-agent-mode suggestions state: visibility and items from the local-agent
 * chat runtime. Never reads the AI slice.
 */
function useLocalAgentSuggestionsState(
  runtime: LocalAgentChatRuntime,
): ChatSuggestionsState {
  return useSuggestionsState({
    mode: 'local-agent',
    visible: runtime.suggestionsVisible,
    setVisible: runtime.setSuggestionsVisible,
    items: runtime.initialSuggestions,
    hasSendableTarget: true,
    hasNoMessages: runtime.messages.length === 0,
  });
}

const suggestionsContext = createDualModeChatContext<ChatSuggestionsState>({
  hookName: 'usePromptSuggestions',
  localAgentProviderName: 'LocalAgentChatSuggestionsProvider',
  boundaryName: 'ChatSuggestionsStateBoundary',
  useSessionState: useSessionSuggestionsState,
  useLocalAgentState: useLocalAgentSuggestionsState,
  // Suggestions state reads the composer's, so a bare boundary has to publish
  // composer state before the session provider below it runs.
  BoundaryOuter: ChatComposerStateBoundary,
});

/**
 * Publishes normalized session-mode suggestions state. Rendered by
 * `Chat.Root`, inside its `SessionChatComposerProvider` (this provider reads
 * {@link useChatComposer}, so it must be nested under one).
 */
export const SessionChatSuggestionsProvider =
  suggestionsContext.SessionProvider;

/**
 * Publishes normalized local-agent-mode suggestions state. Rendered by
 * `Chat.LocalAgentRoot`, inside both its `LocalAgentChatRuntimeProvider` and
 * its `LocalAgentChatComposerProvider`.
 */
export const LocalAgentChatSuggestionsProvider =
  suggestionsContext.LocalAgentProvider;

/**
 * Wraps `children` so that {@link usePromptSuggestions} always has state to
 * read, mirroring {@link ChatComposerStateBoundary}. If an ancestor already
 * published suggestions state, `children` render unchanged; otherwise a
 * session-mode provider (and, since it depends on composer state, a composer
 * boundary above it) is rendered around them.
 */
export const ChatSuggestionsStateBoundary = suggestionsContext.StateBoundary;

/**
 * Reads normalized prompt-suggestions state and actions.
 *
 * Works anywhere under `<Chat>` — under `Chat.Root` it reads session-mode
 * state, under `Chat.LocalAgentRoot` it reads local-agent-mode state — with
 * no required parent for the reading component itself. This is what lets a
 * suggestions list live in a popover or overlay while its toggle lives
 * elsewhere, such as the composer footer, and still stay in sync.
 *
 * Requires published state: render under `Chat.Root`,
 * `Chat.LocalAgentRoot`, or {@link ChatSuggestionsStateBoundary}. Throws
 * otherwise rather than guessing a mode, matching {@link useChatComposer}.
 */
export const usePromptSuggestions = suggestionsContext.useChatState;
