import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type FC,
  type PropsWithChildren,
} from 'react';
import {useStoreWithAi} from '../../AiSlice';
import {isChatSessionEmpty} from '../../contextSelection';
import {
  ChatComposerStateBoundary,
  useChatComposer,
  type ChatComposerMode,
} from '../composer/ChatComposerContext';
import {
  useChatRuntime,
  type LocalAgentChatRuntime,
} from '../ChatRuntimeContext';

/**
 * Normalized prompt-suggestions state and actions, identical in shape across
 * both chat runtime modes.
 *
 * Read via {@link usePromptSuggestions}. This is the behavior layer: no DOM,
 * no styling. `send` and `isReadyToSend` reuse the composer's own send action
 * and readiness signals, so a suggestion and the send control never
 * disagree.
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
   * True when the current chat session (or, in local-agent mode, the
   * message history) has no messages and no in-progress prompt. A suitable
   * predicate for a host that wants to show suggestions only on an empty
   * session — no `when`-style prop is provided for this; branch on this flag
   * instead.
   */
  isSessionEmpty: boolean;
  /** Writes `text` into the prompt without sending it. */
  fill: (text: string) => void;
  /** Sends `text` immediately, subject to {@link isReadyToSend}. */
  send: (text: string) => void;
  /**
   * True when an item's own text could be sent: a model is resolvable
   * (session mode) and nothing is running or summarizing. Built from the same
   * signals as {@link useChatComposer}'s `canSend`, minus its non-empty-prompt
   * requirement, which is the wrong question for an item supplying its own
   * text.
   */
  isReadyToSend: boolean;
}

const ChatSuggestionsContext = createContext<ChatSuggestionsState | null>(null);

const EMPTY_ITEMS: readonly string[] = [];

/**
 * Session-mode suggestions state. Visibility and the empty-session flag come
 * from the AI slice; `fill` and `send` from {@link useChatComposer}.
 */
function useSessionSuggestionsState(): ChatSuggestionsState {
  const visible = useStoreWithAi((s) => s.ai.promptSuggestionsVisible);
  const setVisible = useStoreWithAi((s) => s.ai.setPromptSuggestionsVisible);
  const currentSession = useStoreWithAi((s) => s.ai.getCurrentSession());
  const hasResolvableModel = useStoreWithAi((s) => s.ai.hasResolvableModel());
  const composer = useChatComposer();

  const toggle = useCallback(() => setVisible(!visible), [visible, setVisible]);
  const fill = useCallback(
    (text: string) => composer.setPrompt(text),
    [composer],
  );
  const send = useCallback((text: string) => composer.send(text), [composer]);

  const isSessionEmpty = isChatSessionEmpty(currentSession);
  const isReadyToSend = hasResolvableModel && !composer.isBusy;

  return useMemo(
    () => ({
      mode: 'session' as const,
      visible,
      setVisible,
      toggle,
      items: EMPTY_ITEMS,
      isSessionEmpty,
      fill,
      send,
      isReadyToSend,
    }),
    [visible, setVisible, toggle, isSessionEmpty, fill, send, isReadyToSend],
  );
}

/**
 * Local-agent-mode suggestions state, sourced from the local-agent chat
 * runtime for visibility and items, and from {@link useChatComposer} for
 * `fill` and `send`. Never reads the AI slice.
 */
function useLocalAgentSuggestionsState(
  runtime: LocalAgentChatRuntime,
): ChatSuggestionsState {
  const {suggestionsVisible, setSuggestionsVisible, initialSuggestions} =
    runtime;
  const composer = useChatComposer();

  const toggle = useCallback(
    () => setSuggestionsVisible(!suggestionsVisible),
    [suggestionsVisible, setSuggestionsVisible],
  );
  const fill = useCallback(
    (text: string) => composer.setPrompt(text),
    [composer],
  );
  const send = useCallback((text: string) => composer.send(text), [composer]);

  const isSessionEmpty = runtime.messages.length === 0;
  const isReadyToSend = !composer.isBusy;

  return useMemo(
    () => ({
      mode: 'local-agent' as const,
      visible: suggestionsVisible,
      setVisible: setSuggestionsVisible,
      toggle,
      items: initialSuggestions,
      isSessionEmpty,
      fill,
      send,
      isReadyToSend,
    }),
    [
      suggestionsVisible,
      setSuggestionsVisible,
      toggle,
      initialSuggestions,
      isSessionEmpty,
      fill,
      send,
      isReadyToSend,
    ],
  );
}

/**
 * Publishes normalized session-mode suggestions state. Rendered by
 * `Chat.Root`, inside its `SessionChatComposerProvider` (this provider reads
 * {@link useChatComposer}, so it must be nested under one).
 */
export const SessionChatSuggestionsProvider: FC<PropsWithChildren> = ({
  children,
}) => {
  const value = useSessionSuggestionsState();
  return (
    <ChatSuggestionsContext.Provider value={value}>
      {children}
    </ChatSuggestionsContext.Provider>
  );
};

/**
 * Publishes normalized local-agent-mode suggestions state. Rendered by
 * `Chat.LocalAgentRoot`, inside both its `LocalAgentChatRuntimeProvider` and
 * its `LocalAgentChatComposerProvider`.
 */
export const LocalAgentChatSuggestionsProvider: FC<PropsWithChildren> = ({
  children,
}) => {
  const runtime = useChatRuntime();
  if (runtime.mode !== 'local-agent') {
    throw new Error(
      'LocalAgentChatSuggestionsProvider must be rendered inside LocalAgentChatRuntimeProvider (i.e. under Chat.LocalAgentRoot).',
    );
  }
  const value = useLocalAgentSuggestionsState(runtime);
  return (
    <ChatSuggestionsContext.Provider value={value}>
      {children}
    </ChatSuggestionsContext.Provider>
  );
};

/**
 * Wraps `children` so that {@link usePromptSuggestions} always has state to
 * read, mirroring {@link ChatComposerStateBoundary}. If an ancestor already
 * published suggestions state, `children` render unchanged; otherwise a
 * session-mode provider (and, since it depends on composer state, a composer
 * boundary beneath it) is rendered around them.
 */
export const ChatSuggestionsStateBoundary: FC<PropsWithChildren> = ({
  children,
}) => {
  const provided = useContext(ChatSuggestionsContext);
  if (provided) return <>{children}</>;
  return (
    <ChatComposerStateBoundary>
      <SessionChatSuggestionsProvider>
        {children}
      </SessionChatSuggestionsProvider>
    </ChatComposerStateBoundary>
  );
};

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
export function usePromptSuggestions(): ChatSuggestionsState {
  const provided = useContext(ChatSuggestionsContext);
  if (!provided) {
    throw new Error(
      'usePromptSuggestions() found no suggestions state. Render it under <Chat>, ' +
        '<Chat.Root>, <Chat.LocalAgentRoot>, or wrap it in ' +
        '<ChatSuggestionsStateBoundary>.',
    );
  }
  return provided;
}
