import {createOpenAICompatible} from '@ai-sdk/openai-compatible';
import type {AnalysisSessionSchema} from '@sqlrooms/ai-config';
import type {StoreApi} from '@sqlrooms/room-store';
import {getErrorMessageForDisplay} from '@sqlrooms/utils';
import type {LanguageModel, ToolSet} from 'ai';
import {
  createAgentUIStreamResponse,
  DefaultChatTransport,
  stepCountIs,
  ToolLoopAgent,
  UIMessage,
} from 'ai';
import {produce} from 'immer';
import {
  AI_DEFAULT_TEMPERATURE,
  ANALYSIS_PENDING_ID,
  TOOL_CALL_CANCELLED,
} from './constants';
import type {AiSliceStateForTransport} from './types';
import {
  fixIncompleteToolCalls,
  mergeAbortSignals,
  sanitizeMessagesForLLM,
  shouldEndAnalysis,
} from './utils';

export type ChatTransportConfig = {
  sessionId: string;
  store: StoreApi<AiSliceStateForTransport>;
  defaultProvider: string;
  defaultModel: string;
  headers?: Record<string, string>;
  getInstructions: () => string;
  /**
   * Optional: supply a pre-configured custom model.
   * e.g. import {anthropic} from "@ai-sdk/anthropic";
   * getCustomModel: () => anthropic('claude-sonnet-4-5')
   * If provided, this model will be used instead of the default OpenAI-compatible client.
   */
  getCustomModel?: () => LanguageModel | undefined;
};

function getSessionById(
  store: StoreApi<AiSliceStateForTransport>,
  sessionId: string | undefined,
): AnalysisSessionSchema | undefined {
  if (!sessionId) return undefined;
  return store
    .getState()
    .ai.config.sessions.find((s: AnalysisSessionSchema) => s.id === sessionId);
}

export function createLocalChatTransportFactory({
  sessionId,
  store,
  defaultProvider,
  defaultModel,
  headers,
  getInstructions,
  getCustomModel,
}: ChatTransportConfig) {
  return () => {
    const fetchImpl = async (_input: RequestInfo | URL, init?: RequestInit) => {
      // Parse caller-supplied body defensively to avoid breaking the stream
      const body = init?.body as string;
      let parsed: unknown = {};
      try {
        parsed = body ? JSON.parse(body) : {};
      } catch (parseError) {
        console.error(
          'Failed to parse chat transport body. Messages will be empty.',
          {bodyType: typeof body, bodyLength: body?.length, parseError},
        );
        parsed = {};
      }
      const parsedObj = (parsed as {messages?: unknown}) || {};

      // Resolve provider/model/apiKey/baseUrl at call time to pick up latest settings.
      const state = store.getState();
      const sessionFromBody = getSessionById(store, sessionId);
      const provider = sessionFromBody?.modelProvider || defaultProvider;
      const modelId = sessionFromBody?.model || defaultModel;

      // Fetch API key and base URL dynamically to pick up settings changes
      const apiKey = state.ai.getApiKeyFromSettings();
      const baseUrl = state.ai.getBaseUrlFromSettings();

      // Prefer a user-supplied model if available
      let model: LanguageModel | undefined = getCustomModel?.();

      // Fallback to OpenAI-compatible if no custom model provided
      if (!model) {
        const openai = createOpenAICompatible({
          apiKey,
          name: provider,
          baseURL: baseUrl ?? 'https://api.openai.com/v1',
          headers,
        });
        model = openai.chatModel(modelId);
      }

      const messagesCopy = Array.isArray(parsedObj.messages)
        ? (parsedObj.messages as UIMessage[])
        : [];

      // Pass tools with their execute functions — the ToolLoopAgent runs the
      // full tool loop server-side. UI-approval tools (no execute) are paused
      // by the agent and resumed via addToolOutput from the client.
      // Cast: state.ai.tools holds real AI SDK tools behind StoredToolSet.
      const tools = (state.ai.tools || {}) as ToolSet;

      // get system instructions dynamically at request time to ensure fresh table schema
      const systemInstructions = getInstructions();

      const providerOptions = state.ai.getProviderOptions?.({
        provider,
        modelId,
      });

      // Get abort controller for the owning session (from body) if available
      const sessionAbortSignal = state.ai.getAbortController(sessionId)?.signal;
      // Also respect the request-level abort signal from useChat().stop()
      const abortSignal = mergeAbortSignals([
        init?.signal ?? undefined,
        sessionAbortSignal,
      ]);

      const maxSteps = state.ai.getMaxStepsFromSettings();

      const agent = new ToolLoopAgent({
        model,
        instructions: systemInstructions,
        tools,
        stopWhen: stepCountIs(maxSteps),
        temperature: AI_DEFAULT_TEMPERATURE,
        ...(providerOptions ? {providerOptions} : {}),
      });

      return createAgentUIStreamResponse({
        agent,
        uiMessages: sanitizeMessagesForLLM(
          fixIncompleteToolCalls(messagesCopy),
        ),
        abortSignal,
      });
    };

    return new DefaultChatTransport({fetch: fetchImpl});
  };
}

export function createRemoteChatTransportFactory(params: {
  store: StoreApi<AiSliceStateForTransport>;
  defaultProvider: string;
  defaultModel: string;
  sessionId: string;
  getInstructions: () => string;
}) {
  return (endpoint: string, headers?: Record<string, string>) => {
    const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
      const {store, defaultProvider, defaultModel, sessionId, getInstructions} =
        params;
      // Resolve provider/model/instructions at call time to pick up latest settings.
      const state = store.getState();

      // Parse caller-supplied body defensively to avoid breaking the stream
      const body = init?.body as string;
      let parsed: unknown = {};
      try {
        parsed = body ? JSON.parse(body) : {};
      } catch (parseError) {
        console.error(
          'Failed to parse remote chat transport body. Messages will be empty.',
          {bodyType: typeof body, bodyLength: body?.length, parseError},
        );
        parsed = {};
      }

      const sessionFromBody = getSessionById(store, sessionId);
      const modelProvider = sessionFromBody?.modelProvider || defaultProvider;
      const model = sessionFromBody?.model || defaultModel;

      const parsedObj =
        typeof parsed === 'object' && parsed !== null
          ? (parsed as Record<string, unknown>)
          : {};
      const enhancedBody = {
        ...parsedObj,
        modelProvider,
        model,
        instructions: getInstructions(),
        maxSteps: state.ai.getMaxStepsFromSettings(),
        temperature: AI_DEFAULT_TEMPERATURE,
      };

      // Merge request abort (useChat.stop) with per-session abort (cancelAnalysis)
      const sessionAbortSignal = state.ai.getAbortController(sessionId)?.signal;
      const abortSignal = mergeAbortSignals([
        init?.signal ?? undefined,
        sessionAbortSignal,
      ]);

      // Make the request with enhanced body
      return fetch(input, {
        ...init,
        signal: abortSignal,
        body: JSON.stringify(enhancedBody),
      });
    };

    return new DefaultChatTransport({
      api: endpoint,
      credentials: 'include',
      headers,
      fetch: fetchImpl,
    });
  };
}

export function createChatHandlers({
  store,
}: {
  store: StoreApi<AiSliceStateForTransport>;
}) {
  return {
    onChatFinish: ({
      sessionId,
      messages,
    }: {
      sessionId: string;
      messages: UIMessage[];
    }) => {
      if (!sessionId) return;
      try {
        const state = store.getState();
        const abortController = state.ai.getAbortController(sessionId);

        // check if the analysis has been aborted, force-complete and clean up immediately
        const aborted = !!abortController?.signal.aborted;
        if (aborted) {
          const sessionMessages =
            (getSessionById(store, sessionId)?.uiMessages as UIMessage[]) || [];
          const sourceMessages =
            messages && messages.length > 0 ? messages : sessionMessages;
          const completedMessages = fixIncompleteToolCalls(sourceMessages);
          state.ai.setSessionUiMessages(sessionId, completedMessages);

          state.ai.setIsRunning(sessionId, false);
          state.ai.setAbortController(sessionId, undefined);

          // Force useChat to reinitialize with the fixed messages
          store.setState((s: AiSliceStateForTransport) =>
            produce(s, (draft: AiSliceStateForTransport) => {
              const sess = draft.ai.config.sessions.find(
                (s: AnalysisSessionSchema) => s.id === sessionId,
              );
              if (sess) {
                sess.messagesRevision = (sess.messagesRevision || 0) + 1;
              }
            }),
          );

          // Ensure an analysis result exists and is marked as cancelled
          store.setState((stateToUpdate: AiSliceStateForTransport) =>
            produce(stateToUpdate, (draft: AiSliceStateForTransport) => {
              const targetSession = draft.ai.config.sessions.find(
                (s: AnalysisSessionSchema) => s.id === sessionId,
              );
              if (!targetSession) return;

              const lastUserMessage = completedMessages
                .filter((msg) => msg.role === 'user')
                .slice(-1)[0];
              if (!lastUserMessage) return;

              const promptText = lastUserMessage.parts
                .filter((part) => part.type === 'text')
                .map((part) => (part as {text: string}).text)
                .join('');

              const pendingIndex = targetSession.analysisResults.findIndex(
                (result) => result.id === ANALYSIS_PENDING_ID,
              );

              if (pendingIndex !== -1) {
                targetSession.analysisResults[pendingIndex] = {
                  id: lastUserMessage.id,
                  prompt: promptText,
                  errorMessage: {error: TOOL_CALL_CANCELLED},
                  isCompleted: true,
                };
              } else {
                const existing = targetSession.analysisResults.find(
                  (r) => r.id === lastUserMessage.id,
                );
                if (!existing) {
                  targetSession.analysisResults.push({
                    id: lastUserMessage.id,
                    prompt: promptText,
                    errorMessage: {error: TOOL_CALL_CANCELLED},
                    isCompleted: true,
                  });
                }
              }
            }),
          );
          return;
        }

        // fix any incomplete tool-calls before saving (can happen with AbortController)
        const completedMessages = fixIncompleteToolCalls(messages);
        state.ai.setSessionUiMessages(sessionId, completedMessages);

        store.setState((stateToUpdate: AiSliceStateForTransport) =>
          produce(stateToUpdate, (draft: AiSliceStateForTransport) => {
            const targetSession = draft.ai.config.sessions.find(
              (s: AnalysisSessionSchema) => s.id === sessionId,
            );
            if (!targetSession) return;

            const lastUserMessage = completedMessages
              .filter((msg) => msg.role === 'user')
              .slice(-1)[0];

            if (lastUserMessage) {
              const promptText = lastUserMessage.parts
                .filter((part) => part.type === 'text')
                .map((part) => (part as {text: string}).text)
                .join('');

              const pendingIndex = targetSession.analysisResults.findIndex(
                (result) => result.id === ANALYSIS_PENDING_ID,
              );

              if (pendingIndex !== -1) {
                targetSession.analysisResults[pendingIndex] = {
                  id: lastUserMessage.id,
                  prompt: promptText,
                  isCompleted: true,
                };
              } else {
                const existingResult = targetSession.analysisResults.find(
                  (result) => result.id === lastUserMessage.id,
                );
                if (!existingResult) {
                  targetSession.analysisResults.push({
                    id: lastUserMessage.id,
                    prompt: promptText,
                    isCompleted: true,
                  });
                }
              }
            }
          }),
        );

        if (shouldEndAnalysis(completedMessages)) {
          state.ai.setIsRunning(sessionId, false);
          state.ai.setAbortController(sessionId, undefined);
        }
      } catch (err) {
        console.error('onChatFinish error:', err);
        throw err;
      }
    },
    onChatError: (sessionId: string, error: unknown) => {
      try {
        let errMsg = getErrorMessageForDisplay(error);
        if (!errMsg || errMsg.trim().length === 0) {
          errMsg = 'Unknown error';
        }

        // Detect API key errors (401/403 or common error messages)
        const isApiKeyError = isAuthenticationError(error, errMsg);
        if (isApiKeyError) {
          const session = getSessionById(store, sessionId);
          const provider = session?.modelProvider || 'openai';
          store.getState().ai.setApiKeyError(provider, true);
        }

        store.setState((state: AiSliceStateForTransport) =>
          produce(state, (draft: AiSliceStateForTransport) => {
            if (!sessionId) return;
            const targetSession = draft.ai.config.sessions.find(
              (s: AnalysisSessionSchema) => s.id === sessionId,
            );
            if (targetSession) {
              // fix any incomplete tool-calls before saving (can happen with AbortController)
              const existingMessages = (targetSession.uiMessages ||
                []) as UIMessage[];
              targetSession.uiMessages = fixIncompleteToolCalls(
                existingMessages,
              ) as AnalysisSessionSchema['uiMessages'];

              const uiMessages = targetSession.uiMessages as UIMessage[];
              const lastUserMessage = uiMessages
                .filter((msg) => msg.role === 'user')
                .slice(-1)[0];

              if (lastUserMessage) {
                const promptText = lastUserMessage.parts
                  .filter((part) => part.type === 'text')
                  .map((part) => (part as {text: string}).text)
                  .join('');

                const pendingIndex = targetSession.analysisResults.findIndex(
                  (result) => result.id === ANALYSIS_PENDING_ID,
                );

                if (pendingIndex !== -1) {
                  targetSession.analysisResults[pendingIndex] = {
                    id: lastUserMessage.id,
                    prompt: promptText,
                    errorMessage: {error: errMsg},
                    isCompleted: true,
                  };
                } else {
                  const existingResult = targetSession.analysisResults.find(
                    (result) => result.id === lastUserMessage.id,
                  );

                  if (!existingResult) {
                    targetSession.analysisResults.push({
                      id: lastUserMessage.id,
                      prompt: promptText,
                      errorMessage: {error: errMsg},
                      isCompleted: true,
                    });
                  } else {
                    existingResult.errorMessage = {error: errMsg};
                  }
                }
              }
            }
          }),
        );

        // Force useChat to reinitialize with the fixed messages
        store.setState((s: AiSliceStateForTransport) =>
          produce(s, (draft: AiSliceStateForTransport) => {
            const sess = draft.ai.config.sessions.find(
              (s: AnalysisSessionSchema) => s.id === sessionId,
            );
            if (sess) {
              sess.messagesRevision = (sess.messagesRevision || 0) + 1;
            }
          }),
        );

        store.getState().ai.setIsRunning(sessionId, false);
        store.getState().ai.setAbortController(sessionId, undefined);
      } catch (err) {
        console.error('Failed to store chat error:', err);
        throw err;
      }
    },
  };
}

/**
 * Detects if an error is related to API key authentication issues.
 * Checks for HTTP 401/403 status codes and common error message patterns.
 */
function isAuthenticationError(error: unknown, errorMessage: string): boolean {
  // Check for HTTP status codes in the error object
  if (error && typeof error === 'object') {
    const err = error as Record<string, unknown>;
    const status =
      err.status ??
      err.statusCode ??
      (err.response as Record<string, unknown>)?.status;
    if (status === 401 || status === 403) {
      return true;
    }
  }

  // Check for common authentication error patterns in the message
  const lowerMsg = errorMessage.toLowerCase();
  const authPatterns = [
    'invalid api key',
    'incorrect api key',
    'invalid_api_key',
    'unauthorized',
    'authentication failed',
    'api key is invalid',
    'api key not found',
    'invalid authorization',
    'invalid credentials',
    'access denied',
    '401',
    '403',
  ];

  return authPatterns.some((pattern) => lowerMsg.includes(pattern));
}
