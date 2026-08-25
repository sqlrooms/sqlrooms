import {useCallback, useMemo, type FC, type PropsWithChildren} from 'react';
import {useStoreWithAi} from '../../AiSlice';
import type {LocalAgentChatRuntime} from '../ChatRuntimeContext';
import {
  createDualModeChatContext,
  type ChatComposerMode,
} from '../primitives/createDualModeChatContext';
import {withProvider} from '../primitives/withProvider';
import {
  ChatComposerBeforeSendProvider,
  useSendsBlocked,
  useVetoableSend,
} from './beforeSend';

export type {ChatComposerMode};

/**
 * Normalized composer state and actions, identical in shape across both chat
 * runtime modes.
 *
 * Read via {@link useChatComposer}. This is the behavior layer: it carries no
 * DOM and no styling, and is the supported integration point for a prompt
 * input that is not textarea-shaped (see `Input`'s tsdoc for the
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
   * Sends the current prompt, or `text` when provided instead. A no-op when
   * sending is not currently possible (see {@link canSend}).
   *
   * Registered pre-send vetoes are consulted first (see
   * {@link useRegisterBeforeSend}). In session mode a session is created if
   * none is active, after the vetoes pass.
   */
  send: (text?: string) => void;
  /** Cancels the in-flight run, if any. A no-op when nothing is running. */
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
   *
   * Always `false` in local-agent mode, and in session mode when a
   * custom-model factory supplies its own credentials (see the slice's
   * `requiresApiKey`).
   */
  needsApiKey: boolean;
  /**
   * True while a surface has blocked sending outright (credential entry, say).
   * Already folded into {@link canSend}; read directly for controls that carry
   * their own text.
   */
  sendBlocked: boolean;
}

/**
 * Session-mode composer state, sourced entirely from the AI slice. The prompt
 * reads from the active session when one exists and the shared draft
 * otherwise.
 */
function useSessionComposerState(): ChatComposerState {
  // Select the id, not the session: the session object is replaced as messages
  // stream in, which would re-render every composer on each token.
  const sessionId = useStoreWithAi((s) => s.ai.getCurrentSession()?.id);

  // Short-circuits: `requiresApiKey()` invokes the host's factory, and this
  // selector re-runs once per streamed token.
  const needsApiKey = useStoreWithAi((s) => {
    const apiKey = s.ai.getApiKeyFromSettings();
    const hasUsableKey = apiKey.trim().length > 0 && !s.ai.hasApiKeyError();
    if (hasUsableKey) return false;
    return s.ai.hasResolvableModel() && s.ai.requiresApiKey();
  });
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

  // One predicate for both `canSend` (over the current prompt) and `send`'s own
  // guard (over an optional override), so the two cannot disagree.
  const sendBlocked = useSendsBlocked();

  const canSendText = useCallback(
    (text: string) =>
      hasResolvableModel &&
      !sendBlocked &&
      !isRunning &&
      !isSummarizing &&
      text.trim().length > 0,
    [hasResolvableModel, sendBlocked, isRunning, isSummarizing],
  );

  const canSend = canSendText(prompt);

  const rawSend = useCallback(
    (text?: string) => {
      const value = text ?? prompt;
      if (!canSendText(value)) return;

      let activeSessionId = sessionId;
      if (!activeSessionId) {
        activeSessionId = createSession();
        setPromptAction(activeSessionId, value);
        setDraftPrompt('');
        void runAnalysisWhenReady(activeSessionId);
      } else {
        // With no override the session's stored prompt is already `value`, so
        // only write it back when a caller supplies different text.
        if (text !== undefined) {
          setPromptAction(activeSessionId, value);
        }
        runAnalysis(activeSessionId);
      }
    },
    [
      prompt,
      canSendText,
      sessionId,
      createSession,
      setPromptAction,
      setDraftPrompt,
      runAnalysisWhenReady,
      runAnalysis,
    ],
  );

  const send = useVetoableSend(rawSend, prompt, canSendText);

  const cancel = useCallback(() => {
    if (!sessionId) return;
    cancelAnalysis(sessionId);
  }, [sessionId, cancelAnalysis]);

  const isBusy = isRunning || isSummarizing;

  return useMemo(
    () => ({
      mode: 'session' as const,
      prompt,
      setPrompt,
      send,
      cancel,
      canSend,
      isRunning,
      isBusy,
      needsApiKey,
      sendBlocked,
    }),
    [
      prompt,
      setPrompt,
      send,
      cancel,
      canSend,
      isRunning,
      isBusy,
      needsApiKey,
      sendBlocked,
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

  const sendBlocked = useSendsBlocked();
  // Shared by `canSend` and the pre-send wrapper's guard, so a handler cannot
  // fire for text this mode would refuse to send.
  const canSendText = useCallback(
    (text: string) => !isStreaming && !sendBlocked && text.trim().length > 0,
    [isStreaming, sendBlocked],
  );
  const canSend = canSendText(prompt);

  // `sendPrompt` already matches `send`'s signature and applies the same
  // guards, so only the veto wrapper is added. `stop` returns a promise, so it
  // is wrapped to match `cancel`'s `void` contract.
  const send = useVetoableSend(sendPrompt, prompt, canSendText);

  const cancel = useCallback(() => {
    void stop();
  }, [stop]);

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
      sendBlocked,
    }),
    [prompt, setPrompt, send, cancel, canSend, isStreaming, sendBlocked],
  );
}

const composerContext = createDualModeChatContext<ChatComposerState>({
  hookName: 'useChatComposer',
  localAgentProviderName: 'LocalAgentChatComposerProvider',
  boundaryName: 'ChatComposerStateBoundary',
  useSessionState: useSessionComposerState,
  useLocalAgentState: useLocalAgentComposerState,
});

/** Mounts the veto registry above a state provider, since `send` reads it. */
const withBeforeSend = (
  Provider: FC<PropsWithChildren>,
  displayName: string,
): FC<PropsWithChildren> =>
  withProvider(ChatComposerBeforeSendProvider, Provider, displayName);

/**
 * Publishes normalized session-mode composer state. Rendered by `Chat.Root`.
 */
export const SessionChatComposerProvider = withBeforeSend(
  composerContext.SessionProvider,
  'SessionChatComposerProvider',
);

/**
 * Publishes normalized local-agent-mode composer state. Rendered by
 * `Chat.LocalAgentRoot`, inside its `LocalAgentChatRuntimeProvider`.
 */
export const LocalAgentChatComposerProvider = withBeforeSend(
  composerContext.LocalAgentProvider,
  'LocalAgentChatComposerProvider',
);

/**
 * Wraps `children` so that {@link useChatComposer} always has state to read.
 *
 * If an ancestor already published composer state (`Chat.Root` or
 * `Chat.LocalAgentRoot`), `children` render unchanged. Otherwise a
 * session-mode provider is rendered around them, so a composer used without a
 * `<Chat>` ancestor still works.
 */
export const ChatComposerStateBoundary = withBeforeSend(
  composerContext.StateBoundary,
  'ChatComposerStateBoundary',
);

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
export const useChatComposer = composerContext.useChatState;
