import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type FC,
  type PropsWithChildren,
} from 'react';
import {useStoreWithAi} from '../../AiSlice';
import {
  useChatRuntime,
  type LocalAgentChatRuntime,
} from '../ChatRuntimeContext';

/**
 * Which chat runtime a {@link ChatComposerState} was normalized from.
 *
 * `'session'` sources state from the AI slice (`useStoreWithAi`); `'local-agent'`
 * sources state from the local-agent chat runtime
 * ({@link LocalAgentChatRuntime}) and never touches the AI slice.
 */
export type ChatComposerMode = 'session' | 'local-agent';

/**
 * Normalized composer state and actions, identical in shape across both chat
 * runtime modes.
 *
 * Read via {@link useChatComposer}. This is the behavior layer: it carries no
 * DOM and no styling, and is the supported integration point for a prompt
 * input that is not textarea-shaped (see {@link Input}'s tsdoc for the
 * textarea-shaped contract that primitive is limited to).
 */
export interface ChatComposerState {
  /** Which runtime this state was sourced from. */
  mode: ChatComposerMode;
  /**
   * The current prompt text. In session mode this reads from the active
   * session when one exists, and from the shared draft prompt otherwise, so
   * a suggestions list and the composer always agree before a session is
   * created.
   */
  prompt: string;
  /** Updates the prompt in whichever store currently backs it. */
  setPrompt: (value: string) => void;
  /**
   * Sends the current prompt, or `text` when provided instead of it.
   *
   * A no-op when sending is not currently possible (see {@link canSend}).
   * In session mode, sending with no active session creates one, transfers
   * the prompt into it, clears the shared draft, and starts analysis through
   * the when-ready entry point; sending with an active session starts
   * analysis on it directly.
   */
  send: (text?: string) => void;
  /**
   * Cancels the in-flight run, if any. A no-op when nothing is running.
   */
  cancel: () => void;
  /**
   * True when {@link send} would currently do something: a model is
   * resolvable, the prompt is non-empty once trimmed, and nothing is already
   * running or summarizing.
   */
  canSend: boolean;
  /** True while a response is being generated. */
  isRunning: boolean;
  /**
   * True while the composer should present as busy for any reason —
   * currently running, or (session mode only) summarizing the conversation.
   */
  isBusy: boolean;
  /**
   * True when an API key must be supplied before sending can succeed.
   * Always `false` in local-agent mode, which has no concept of a
   * browser-held API key.
   */
  needsApiKey: boolean;
}

const ChatComposerContext = createContext<ChatComposerState | null>(null);

/**
 * Session-mode composer state, sourced entirely from the AI slice.
 *
 * Reproduces `QueryControls`' existing send semantics exactly: the prompt
 * reads from the active session when one exists and the shared draft
 * otherwise; sending with no session creates one, transfers the prompt,
 * clears the draft, and starts via the when-ready entry point; sending with
 * an active session starts analysis on it directly; cancel cancels that
 * session's run.
 */
function useSessionComposerState(): ChatComposerState {
  const currentSession = useStoreWithAi((s) => s.ai.getCurrentSession());
  const sessionId = currentSession?.id;

  const apiKey = useStoreWithAi((s) => s.ai.getApiKeyFromSettings());
  const hasApiKeyError = useStoreWithAi((s) => s.ai.hasApiKeyError());
  const hasResolvableModel = useStoreWithAi((s) => s.ai.hasResolvableModel());

  const isRunning = useStoreWithAi((s) =>
    sessionId ? s.ai.getIsRunning(sessionId) : false,
  );
  const isSummarizing = useStoreWithAi((s) => s.ai.isSummarizing);

  const draftPrompt = useStoreWithAi((s) => s.ai.draftPrompt);
  const setDraftPrompt = useStoreWithAi((s) => s.ai.setDraftPrompt);
  const storedPrompt = useStoreWithAi((s) =>
    sessionId ? s.ai.getPrompt(sessionId) : '',
  );
  const prompt = sessionId ? storedPrompt : draftPrompt;

  const setPromptAction = useStoreWithAi((s) => s.ai.setPrompt);
  const createSession = useStoreWithAi((s) => s.ai.createSession);
  const runAnalysis = useStoreWithAi((s) => s.ai.startAnalysis);
  const runAnalysisWhenReady = useStoreWithAi(
    (s) => s.ai.startAnalysisWhenReady,
  );
  const cancelAnalysis = useStoreWithAi((s) => s.ai.cancelAnalysis);

  const setPrompt = useCallback(
    (value: string) => {
      if (sessionId) {
        setPromptAction(sessionId, value);
      } else {
        setDraftPrompt(value);
      }
    },
    [sessionId, setPromptAction, setDraftPrompt],
  );

  const canSend =
    hasResolvableModel &&
    prompt.trim().length > 0 &&
    !isRunning &&
    !isSummarizing;

  const send = useCallback(
    (text?: string) => {
      const value = text ?? prompt;
      if (
        isRunning ||
        isSummarizing ||
        !hasResolvableModel ||
        !value.trim().length
      ) {
        return;
      }

      let activeSessionId = sessionId;
      if (!activeSessionId) {
        activeSessionId = createSession();
        setPromptAction(activeSessionId, value);
        setDraftPrompt('');
        // The compatibility entry point creates the controller synchronously;
        // callers do not depend on a mounted chat surface.
        void runAnalysisWhenReady(activeSessionId);
      } else {
        // Match `QueryControls` exactly: with no override, the session's
        // stored prompt is already `value` (that's what `prompt` reads from),
        // so only write it back when a caller explicitly overrides the text
        // (e.g. a suggestion sent into an existing session).
        if (text !== undefined) {
          setPromptAction(activeSessionId, value);
        }
        runAnalysis(activeSessionId);
      }
    },
    [
      prompt,
      isRunning,
      isSummarizing,
      hasResolvableModel,
      sessionId,
      createSession,
      setPromptAction,
      setDraftPrompt,
      runAnalysisWhenReady,
      runAnalysis,
    ],
  );

  const cancel = useCallback(() => {
    if (!sessionId) return;
    cancelAnalysis(sessionId);
  }, [sessionId, cancelAnalysis]);

  const needsApiKey =
    hasResolvableModel &&
    (!apiKey || apiKey.trim().length === 0 || hasApiKeyError);

  return useMemo(
    () => ({
      mode: 'session' as const,
      prompt,
      setPrompt,
      send,
      cancel,
      canSend,
      isRunning,
      isBusy: isRunning || isSummarizing,
      needsApiKey,
    }),
    [
      prompt,
      setPrompt,
      send,
      cancel,
      canSend,
      isRunning,
      isSummarizing,
      needsApiKey,
    ],
  );
}

/**
 * Local-agent-mode composer state, sourced entirely from the local-agent
 * chat runtime. Never reads the AI slice, so it works in apps that have no
 * AI slice in their room store at all.
 */
function useLocalAgentComposerState(
  runtime: LocalAgentChatRuntime,
): ChatComposerState {
  const {prompt, setPrompt, sendPrompt, stop, isStreaming} = runtime;

  const send = useCallback(
    (text?: string) => {
      sendPrompt(text);
    },
    [sendPrompt],
  );

  const cancel = useCallback(() => {
    stop();
  }, [stop]);

  const canSend = !isStreaming && prompt.trim().length > 0;

  return useMemo(
    () => ({
      mode: 'local-agent' as const,
      prompt,
      setPrompt,
      send,
      cancel,
      canSend,
      isRunning: isStreaming,
      isBusy: isStreaming,
      needsApiKey: false,
    }),
    [prompt, setPrompt, send, cancel, canSend, isStreaming],
  );
}

/**
 * Publishes normalized session-mode composer state. Rendered by `Chat.Root`.
 */
export const SessionChatComposerProvider: FC<PropsWithChildren> = ({
  children,
}) => {
  const value = useSessionComposerState();
  return (
    <ChatComposerContext.Provider value={value}>
      {children}
    </ChatComposerContext.Provider>
  );
};

/**
 * Publishes normalized local-agent-mode composer state. Rendered by
 * `Chat.LocalAgentRoot`, inside its `LocalAgentChatRuntimeProvider`.
 */
export const LocalAgentChatComposerProvider: FC<PropsWithChildren> = ({
  children,
}) => {
  const runtime = useChatRuntime();
  if (runtime.mode !== 'local-agent') {
    throw new Error(
      'LocalAgentChatComposerProvider must be rendered inside LocalAgentChatRuntimeProvider (i.e. under Chat.LocalAgentRoot).',
    );
  }
  const value = useLocalAgentComposerState(runtime);
  return (
    <ChatComposerContext.Provider value={value}>
      {children}
    </ChatComposerContext.Provider>
  );
};

/**
 * Wraps `children` so that {@link useChatComposer} always has state to read.
 *
 * If an ancestor already published composer state (i.e. `Chat.Root` or
 * `Chat.LocalAgentRoot` is above), `children` render unchanged. Otherwise a
 * session-mode provider is rendered around them, so a composer used without
 * an explicit `<Chat>` ancestor still works.
 *
 * The dispatch is deliberately at the component level rather than inside
 * {@link useChatComposer}: choosing between "already provided" and "provide
 * session mode" by branching on a hook call would change hook order if a
 * subtree were ever re-parented under a provider. Here the provider's own
 * hooks live in a child that mounts and unmounts as a unit, so no such
 * hazard exists — and local-agent trees, which must never touch the AI
 * slice, never render the session provider at all.
 */
export const ChatComposerStateBoundary: FC<PropsWithChildren> = ({
  children,
}) => {
  const provided = useContext(ChatComposerContext);
  if (provided) return <>{children}</>;
  return <SessionChatComposerProvider>{children}</SessionChatComposerProvider>;
};

/**
 * Reads normalized composer state and actions.
 *
 * Works anywhere under `<Chat>` — under `Chat.Root` it reads session-mode
 * state, under `Chat.LocalAgentRoot` it reads local-agent-mode state. This is
 * what lets a suggestions toggle and its list live in different parts of the
 * tree and still agree.
 *
 * Requires published state: render under `Chat.Root`,
 * `Chat.LocalAgentRoot`, or {@link ChatComposerStateBoundary}. Throws
 * otherwise rather than guessing a mode, since a silent session-mode default
 * would reach for the AI slice in trees that may not have one.
 */
export function useChatComposer(): ChatComposerState {
  const provided = useContext(ChatComposerContext);
  if (!provided) {
    throw new Error(
      'useChatComposer() found no composer state. Render it under <Chat>, ' +
        '<Chat.Root>, <Chat.LocalAgentRoot>, or wrap it in ' +
        '<ChatComposerStateBoundary>.',
    );
  }
  return provided;
}
